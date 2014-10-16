
var hat = require('hat');
var rack = hat.rack(512, 36);
var wkt = require('terraformer-wkt-parser');
var passgen = require('password-hash-and-salt');
var when = require('when');

module.exports = {

  create: function(req, res) {
    validate()
      .then(function () {
        run();
      })
      .catch(function (err) {
        // do nothing
      });

    function run() {
      var data = req.body;
      if (_.isEmpty(data.location)) {
        data.location = {};
      }
      else {
        data.location.latitude = parseFloat(data.location.latitude);
        data.location.longitude = parseFloat(data.location.longitude);
        data.point = 'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            data.location.longitude,
            data.location.latitude
          ]
        });
      }

      if (!data.address) {
        data.address = {};
      }

      passgen(data.password).hash(sails.config.session.secret, function(err, hashedPassword) {
        var values = [
          data.email,
          hashedPassword,
          data.tel,
          data.gender,
          data.birthYear,
          data.address.subdistrict,
          data.address.district,
          data.address.city,
          data.location.latitude,
          data.location.longitude,
          data.point,
          new Date(),
          new Date(),
          // platform at the time register.
          req.body.platform || req.query.platform || 'doctormeios'
        ];

        save(values);
      });
    }

    function save(values) {
      var now = (new Date()).getTime();

      pgconnect(function(err, client, done) {
        sails.log.debug('[UsersController:insert user]', now);

        if (err) return res.serverError("Could not connect to database");

        client.query('\
          INSERT \
          INTO "users" ( \
            "email", "password", "tel", "gender", "birthYear", "subdistrict", "district", \
            "city", "latitude", "longitude", "geom", "createdAt", "updatedAt", "platform" \
          ) \
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING * \
        ', values, function(err, result) {

          if (err) {
            if (err.detail && err.detail.match(/Key \(email\).*already exists/)) {
              res.conflict("This e-mail is already registered, please login or try another e-mail");
            }
            else {
              res.serverError("Could not perform your request", err);
            }

            done();
            sails.log.debug('[UsersController:insert user]', now);
            return;
          }

          var savedUser = result.rows[0];

          // Then generate accessToken.
          var accessToken;
          AccessTokenService.refresh(savedUser.id)
            .then(function(_accessToken) {
              accessToken = _accessToken;

              if (req.body.deviceToken === '') {
                return UserService.removeDefaultUserDevice(savedUser);
              }
              else if (req.body.deviceToken) {
                return UserService.setDevice(savedUser, {
                  id: req.body.deviceToken,
                  platform: req.body.platform || req.query.platform || savedUser.platform
                });
              }
            })
            .then(function() {
              if (savedUser.email.match(/\@(www\.)?sicksense\.org$/)) {
                return when.resolve();
              }

              // check if subscribed account then send verification e-mail.
              var config = sails.config.mail.verificationEmail,
                  subject = config.subject,
                  body = config.body,
                  from = config.from,
                  to = savedUser.email,
                  html = config.html;

              // Async here. User can still successful register if this method fail.
              OnetimeTokenService.create('user.verifyEmail', savedUser.id, sails.config.onetimeToken.lifetime)
                .then(function (tokenObject) {
                  var url = req.getWWWUrl(sails.config.common.verifyEndpoint, {
                    token: tokenObject.token
                  });

                  // substitute value in body, html
                  body = body.replace(/\%token%/, url);
                  html = html.replace(/\%token%/, url);

                  return MailService.send(subject, body, from, to, html);
                })
                .catch(function (err) {
                  sails.log.error(new Error('Can not send verification e-mail'), err);
                });
            })
            .then(function() {
              return UserService.getDefaultDevice(savedUser)
                .then(function (device) {
                  var extra = {
                    accessToken: accessToken.token
                  };
                  if (device) {
                    extra.deviceToken = device.id;
                  }

                  if (req.body.subscribe) {
                    return EmailSubscriptionsService.subscribe(client, savedUser)
                      .then(function() {
                        res.ok(UserService.getUserJSON(savedUser, extra));
                      });
                  }
                  else {
                    res.ok(UserService.getUserJSON(savedUser, extra));
                  }
                });
            })
            .catch(function(err) {
              sails.log.error(err);
              res.serverError(new Error("Registration is success but cannot automatically login. Please login manually."));
            })
            .finally(function() {
              done();
              sails.log.debug('[UsersController:insert user]', now);
            });

        });
      });
    }

    function validate() {
      return when.promise(function (resolve, reject) {
        req.checkBody('email', 'E-mail field is required').notEmpty();
        req.checkBody('email', 'E-mail field is not valid').isEmail();

        req.checkBody('password', 'Password field is required').notEmpty();
        req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);

        if (req.body.gender) {
          req.checkBody('gender', 'Gender field is not valid').isIn(['male', 'female']);
        }

        if (req.body.birthYear) {
          req.sanitize('birthYear').toInt();
          req.checkBody('birthYear', 'Birth Year field is required').notEmpty();
          req.checkBody('birthYear', 'Birth Year field is required').isInt();
          req.checkBody('birthYear', 'Birth Year field is not valid').isBetween(1900, (new Date()).getUTCFullYear());
        }

        if (!_.isEmpty(req.body.address)) {
          req.checkBody('address.subdistrict', 'Address:Subdistrict field is required').notEmpty();
          req.checkBody('address.district', 'Address:District field is required').notEmpty();
          req.checkBody('address.city', 'Address:City field is required').notEmpty();
        }

        if (!_.isEmpty(req.body.location)) {
          req.sanitize('location.latitude').toFloat();
          req.sanitize('location.longitude').toFloat();
          req.checkBody('location.latitude', 'Location:Latitude field is required').notEmpty();
          req.checkBody('location.latitude', 'Location:Latitude field is not valid').isFloat();
          req.checkBody('location.latitude', 'Location:Latitude field is not valid').isBetween(-90, 90);
          req.checkBody('location.longitude', 'Location:Longitude field is required').notEmpty();
          req.checkBody('location.longitude', 'Location:Longitude field is not valid').isFloat();
          req.checkBody('location.longitude', 'Location:Longitude field is not valid').isBetween(-180, 180);
        }

        if (req.body.platform || req.query.platform) {
          req.sanitize('platform').trim();
        }

        var errors = req.validationErrors();
        var paramErrors = req.validationErrors(true);
        if (errors) {
          res.badRequest(_.first(errors).msg, paramErrors);
          return reject(errors);
        }

        if (!_.isEmpty(req.body.address)) {
          // Then verify user address.
          LocationService.getLocationByAddress(req.body.address)
            .then(function () {
              resolve();
            })
            .catch(function (err) {
              if (err.toString().match('not found')) {
                err = "Address field is not valid. Address not found";
              }
              res.badRequest(err, {
                address: {
                  msg: err
                }
              });
              return reject(err);
            });
        }
        else {
          resolve();
        }
      });
    }
  },

  update: function(req, res) {
    var accessToken;

    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, _accessToken) {
      if (err) {
        sails.log.error(err);
        return res.accessToken(new Error("Could not perform your request"));
      }

      accessToken = _accessToken;

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden(new Error("Can not save to other profile"));
      }

      validate()
        .then(function () {
          if (req.body.password) {
            passgen(req.body.password).hash(sails.config.session.secret, function(err, hashedPassword) {
              run(hashedPassword);
            });
          }
          else {
            run();
          }
        })
        .catch(function (err) {
          // do nothing
          sails.log.error(err);
        });
    });

    function run(hashedPassword) {
      var now = (new Date()).getTime();

      var data = [
        { field: '"updatedAt" = $', value: new Date() }
      ];

      if (req.body.email) {
        data.push({
          field: '"email" = $',
          value: req.body.email
        });
      }
      if (hashedPassword) {
        data.push({
          field: '"password" = $',
          value: hashedPassword
        });
      }
      if (req.body.gender) {
        data.push({
          field: '"gender" = $',
          value: req.body.gender
        });
      }
      if (req.body.birthYear) {
        data.push({
          field: '"birthYear" = $',
          value: req.body.birthYear
        });
      }
      if (!_.isEmpty(req.body.address) && req.body.address.subdistrict) {
        data.push({
          field: '"subdistrict" = $',
          value: req.body.address.subdistrict
        });
      }
      if (!_.isEmpty(req.body.address) && req.body.address.district) {
        data.push({
          field: '"district" = $',
          value: req.body.address.district
        });
      }
      if (!_.isEmpty(req.body.address) && req.body.address.city) {
        data.push({
          field: '"city" = $',
          value: req.body.address.city
        });
      }
      if (req.body.platform || req.query.platform) {
        data.push({
          field: '"platform" = $',
          value: req.body.platform || req.query.platform
        });
      }

      var conditions = [
        { field: 'id = $', value: req.user.id }
      ];

      DBService.update('users', data, conditions)
        .then(function (users) {

          var promise = when.resolve();

          var savedUser = users.rows[0];

          if (req.body.deviceToken === '') {
            promise = UserService.removeDefaultUserDevice(savedUser);
          }
          else if (req.body.deviceToken) {
            promise = UserService.clearDevices(req.user)
              .then(function () {
                return UserService.setDevice(savedUser, {
                  id: req.body.deviceToken,
                  platform: req.body.platform || req.query.platform || savedUser.platform
                });
              });
          }

          pgconnect(function(err, client, pgDone) {
            if (err) return res.serverError('Could not connect to database.');

            if (req.body.subscribe) {
              promise = EmailSubscriptionsService.subscribe(client, req.user).then(function () {
                pgDone();

                return true;
              });
            } else {

              promise = EmailSubscriptionsService.unsubscribe(client, req.user).then(function () {
                pgDone();

                return false;
              });
            }
          });

          return promise.then(function (isSubscribed) {
            UserService.getDefaultDevice(savedUser)
              .then(function (device) {
                var extra = {
                  accessToken: accessToken.token,
                  isSubscribed: isSubscribed
                };
                if (device) {
                  extra.deviceToken = device.id;
                }
                res.ok(UserService.getUserJSON(savedUser, extra));
              });
          });

        }) // end then()
        .catch(function (err) {
          sails.log.error(err);
          return res.serverError("Could not perform your request");
        }); // end DBService.update()
    }

    function validate() {
      return when.promise(function (resolve, reject) {

        if (req.body.password) {
          req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);
        }

        if (req.body.gender) {
          req.checkBody('gender', 'Gender field is not valid').isIn(['male', 'female']);
        }

        if (req.body.birthYear) {
          req.sanitize('birthYear').toInt();
          req.checkBody('birthYear', 'Birth Year field is required').notEmpty();
          req.checkBody('birthYear', 'Birth Year field is required').isInt();
          req.checkBody('birthYear', 'Birth Year field is not valid').isBetween(1900, (new Date()).getUTCFullYear());
        }

        if (!_.isEmpty(req.body.address)) {
          req.checkBody('address.subdistrict', 'Address:Subdistrict field is required').notEmpty();
          req.checkBody('address.district', 'Address:District field is required').notEmpty();
          req.checkBody('address.city', 'Address:City field is required').notEmpty();
        }

        var errors = req.validationErrors();
        var paramErrors = req.validationErrors(true);
        if (errors) {
          return res.badRequest(_.first(errors).msg, paramErrors);
        }

        var promise = when.resolve();

        // Then verify user address.
        if (!_.isEmpty(req.body.address)) {
          promise = promise.then(function () {
            return when.promise(function (resolve, reject) {

              LocationService.getLocationByAddress(req.body.address)
                .then(resolve)
                .catch(function (err) {
                  if (err.toString().match('not found')) {
                    err = "Address field is not valid. Address not found";

                    res.badRequest(err, {
                      address: {
                        msg: err
                      }
                    });
                  }
                  else {
                    sails.log.error(err);
                    res.serverError("Server error", err);
                  }

                  reject(err);
                });

            });

          });
        }

        if (req.body.email) {
          promise = promise.then(function () {
            return when.promise(function (resolve, reject) {

              var now = (new Date()).getTime();

              pgconnect()
                .then(function (conn) {
                  sails.log.debug('[UsersController:update e-mail]', now);
                  return when.resolve(conn);
                })
                .then(function (conn) {
                  var query = "SELECT id FROM users WHERE email = $1 AND email <> $2";
                  var values = [ req.body.email, req.user.email ];

                  conn.client.query(query, values, function (err, result) {
                    conn.done();
                    sails.log.debug('[UsersController:update e-mail]', now);

                    if (err) {
                      sails.log.error(err);
                      res.serverError("Server error", err);
                      return reject(err);
                    }

                    if (result.rows.length > 0) {
                      res.conflict("E-mail in `email` field is already existed", {
                        email: {
                          msg: "E-mail in `email` field is already existed"
                        }
                      });

                      return reject("Duplicated e-mail update");
                    }

                    resolve();
                  });
                })
                .catch(function (err) {
                  sails.log.error(err);
                  res.serverError("Server error", err);
                  return reject(err);
                });

            });

          });
        }

        promise
          .then(function () {
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });
      });
    }
  },

  userReports: function(req, res) {
    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, accessToken) {
      if (err) {
        sails.log.error(err);
        return res.accessToken(new Error("Could not perform your request"));
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden(new Error("You can not get another user's reports"));
      }

      if (req.query.offset) {
        req.sanitize('offset', 'Field `offset` is not valid').toInt();
      }
      if (req.query.limit) {
        req.sanitize('limit', 'Field `limit` is not valid').toInt();
      }

      var errors = req.validationErrors();
      var paramErrors = req.validationErrors(true);
      if (errors) {
        return res.badRequest(_.first(errors).msg, paramErrors);
      }

      var query = _.extend({
        offset: 0,
        limit: 10
      }, req.query);

      var now = (new Date()).getTime();
      pgconnect(function(err, client, pgDone) {
        if (err) {
          sails.log.error(err);
          return res.serverError(new Error("Could not connect to database"));
        }
        sails.log.debug('[UsersController:userReports()]', now);

        var selectQuery, selectValues, countQuery, countValues;

        selectQuery = '\
          SELECT * \
          FROM reports r \
          ORDER BY r."createdAt" DESC \
          LIMIT $1 OFFSET $2\
        ';
        selectValues = [ query.limit, query.offset ];

        countQuery = '\
          SELECT COUNT(r.id) as total \
          FROM reports r \
        ';
        countValues = [];

        client.query(selectQuery, selectValues, function(err, result) {
          if (err) {
            sails.log.error(err);
            return res.serverError(new Error("Could not perform your request"));
          }

          client.query(countQuery, countValues, function(err, countResult) {
            pgDone();
            sails.log.debug('[UsersController:userReports()]', now);

            if (err) {
              sails.log.error(err);
              return res.serverError(new Error("Could not perform your request"));
            }

            when.map(result.rows, function(row) {
              return when.promise(function(resolve, reject) {
                ReportService.loadSymptoms(row)
                  .then(function(symptoms) {
                    row.symptoms = symptoms;
                    resolve();
                  })
                  .catch(reject);
              });
            }).then(function() {
              res.ok({
                reports: {
                  count: parseInt(countResult.rows[0].total),
                  items: _.map(result.rows, function(row) {
                    return ReportService.getReportJSON(row, { symptoms: row.symptoms });
                  })
                }
              });
            });
          });
        });
      });
    });
  },

  getUser: function(req, res) {
    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, accessToken) {
      if (err) {
        sails.log.error(err);
        return res.accessToken(new Error("Could not perform your request"));
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden(new Error("You can not get another user's reports"));
      }

      pgconnect(function(err, client, done) {
        if (err) return res.serverError('Could not connect to database.');

        EmailSubscriptionsService.isSubscribed(client, req.user).then(function (isSubscribed) {
          var user = UserService.getUserJSON(req.user, {
            isSubscribed: isSubscribed
          });
          res.ok(user);
        });
      });
    });
  },

  forgotPassword: function(req, res) {
    var localUser;
    var email = req.body.email;
    if (email) {
      pgconnect(function(err, client, done) {
        if (err) return res.serverError('Could not connect to database.');

        UserService.getUserByEmail(client, email)
          .then(function(user) {
            localUser = user;
            return OnetimeTokenService.getByEmail(user.email, 'user.resetPassword');
          })
          .then(function(token) {
            if (token) {
              return OnetimeTokenService.delete(token.user_id, token.type);
            }

            return when.promise(function(resolve, reject) {
              resolve();
            });
          })
          .then(function() {
            return OnetimeTokenService.create('user.resetPassword', localUser.id, sails.config.onetimeToken.lifetime);
          })
          .then(function(token) {
            var siteURL = sails.config.siteURL;
            var resetURL = siteURL + '/reset-password.html?token=' + token.token;
            var subject = sails.config.mail.forgotPassword.subject;
            var from = sails.config.mail.forgotPassword.from;
            var to = localUser.email;
            var body = sails.config.mail.forgotPassword.text.replace(/\%reset_password_url\%/g, resetURL);
            var html = sails.config.mail.forgotPassword.html.replace(/\%reset_password_url\%/g, resetURL);
            return MailService.send(subject, body, from, to, html);
          })
          .then(function() {
            return res.ok({
              'message': 'E-mail has been sent to ' + email + '.'
            });
          })
          .catch(function(err) {
            sails.log.error(err);
            return res.forbidden(err);
          })
          .finally(function() {
            done();
          });
      });
    }
    else {
      sails.log.error('E-mail is not provided');
      res.forbidden('E-mail is not provided.');
    }
  },

  resetPassword: function(req, res) {
    var onetimeToken;

    validate()
      .then(function(tokenObject) {
        onetimeToken = tokenObject;
        if (!onetimeToken) {
          return res.forbidden('Token is invalid');
        }

        OnetimeTokenService.delete(onetimeToken.user_id, onetimeToken.type)
          .then(function() {
            var password = req.body.password;
            passgen(password).hash(sails.config.session.secret, function(err, hashedPassword) {
              updatePassword(hashedPassword);
            });
          })
          .catch(function(err) {
            return res.serverError(err)
          });
      })
      .catch(function(err) {
        return res.serverError(err)
      });

    function updatePassword(hashedPassword) {
      var values = [{ field: 'password = $', value: hashedPassword }];
      var conditions = [{ field: 'id = $', value: onetimeToken.user_id }];
      DBService.update('users', values, conditions)
        .then(function(result) {
          return result.rows[0];
        })
        .then(function(returnedUser) {

          AccessToken.findOneByUserId(returnedUser.id).exec(function(err, accessToken) {
            if (err) return res.serverError(err);

            if (accessToken) {
              returnedUser = UserService.getUserJSON(returnedUser, {
                accessToken: accessToken.token
              });

              return res.ok({
                message: 'Password has been updated.',
                user: returnedUser
              });
            }
            else {
              AccessTokenService.refresh(returnedUser.id)
                .then(function(accessToken) {
                  returnedUser = UserService.getUserJSON(returnedUser, {
                    accessToken: accessToken.token
                  });

                  return res.ok({
                    message: 'Password has been updated.',
                    user: returnedUser
                  });
                })
                .catch(function(err) {
                  res.serverError(err);
                });
            }
          });
        })
        .catch(function(err) {
          return res.serverError(err);
        });
    };

    function validate() {
      return when.promise(function(resolve, reject) {
        req.checkBody('token', 'Token is required').notEmpty();
        req.checkBody('password', 'Password is required').notEmpty();

        var errors = req.validationErrors();
        var paramErrors = req.validationErrors(true);
        if (errors) {
          res.badRequest(_.first(errors).msg, paramErrors);
          return reject(errors);
        }

        var token = req.body.token;
        OnetimeTokenService.getByToken(token)
          .then(function(tokenObject) {
            resolve(tokenObject);
          })
          .catch(function(err) {
            reject(err);
          });
      });
    }
  },

  verify: function (req, res) {
    req.check('token', '`token` field is required').notEmpty();

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    // check token validation.
    OnetimeTokenService.getByTokenString(req.body.token)
      .then(function (tokenObject) {

        var data = {};

        if (OnetimeTokenService.isValidToken(tokenObject)) {

          UserService.verify(tokenObject.user_id)
            .then(function () {
              return OnetimeTokenService.delete(tokenObject.user_id, tokenObject.type);
            })
            .then(function () {
              return DBService.select('users', '*', [
                { field: 'id = $', value: tokenObject.user_id }
              ]);
            })
            .then(function (result) {
              data.user = result.rows[0];

              return DBService.select('accesstoken', '*', [
                { field: '"userId" = $', value: tokenObject.user_id }
              ]);
            })
            .then(function (result) {
              var accessToken = result.rows[0];
              if (accessToken) {
                data.user = UserService.getUserJSON(data.user, {
                  accessToken: accessToken.token
                });
                res.ok(data.user);
              }
              else {
                return AccessTokenService.refresh(data.user.id).then(function(accessToken) {
                    data.user = UserService.getUserJSON(data.user, {
                      accessToken: accessToken.token
                    });
                    res.ok(data.user);
                  });
              }
            })
            .catch(function (err) {
              sails.log.error('UsersController.verify()::', err);
              res.serverError('Server error, Cannot verify user e-mail. Please try again', err);
            });

        }
        else {
          res.forbidden('Invalid Token');
        }
      });
  }

};
