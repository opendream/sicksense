
var hat = require('hat');
var rack = hat.rack(512, 36);
var wkt = require('terraformer-wkt-parser');
var passgen = require('password-hash-and-salt');
var when = require('when');

module.exports = {

  create: function(req, res) {
    var now = (new Date()).getTime();
    var data = {};
    var user;

    validate()
      .then(function () {
        prepare();
        run();
      })
      .catch(function (err) {
        // do nothing
      });

    function run() {
      checkUserEmailExists(data.email)
        .then(function(exists) {
          if (exists) {
            return res.conflict('This e-mail is already registered, please login or try another e-mail.');
          }

          return createUser(data)
            .then(function() {
              return createAccessToken();
            })
            .then(function() {
              return createUserDeviceToken();
            })
            .then(function() {
              if (data.sicksense) {
                return checkSicksenseEmailExists(data.sicksense.email)
                  .then(function (exists) {
                    if (exists) {
                      return res.conflict('This e-mail is already registered, please login or try another e-mail');
                    }
                    else {
                      return createSicksenseID(data)
                        .then(function() {
                          return sendEmailVerification();
                        })
                        .then(function() {
                          return subscribeUser();
                        })
                        .then(function() {
                          return responseJSON();
                        })
                        .catch(function (err) {
                          res.serverError(err);
                        });
                    }
                  })
                  .catch(function (err) {
                    res.serverError(err);
                  });
              }

              return responseJSON();
            })
            .catch(function (err) {
              res.serverError(err);
            });
        })
        .catch(function (err) {
          res.serverError(err);
        });
    };

    function prepare() {
      var body = req.body;
      data = {};

      if (_.isEmpty(body.location)) {
        data.location = {};
      }
      else {
        data.latitude = parseFloat(body.location.latitude);
        data.longitude = parseFloat(body.location.longitude);
        data.geom = 'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            data.longitude,
            data.latitude
          ]
        });
      }

      if (!body.address) {
        body.address = {};
      }

      if (isSicksenseID(body.email)) {
        data.sicksense = {
          email: body.email,
          password: body.password
        };
      }

      data.email = body.uuid + '@sicksense.org';
      data.password = body.uuid;
      data.tel = body.tel;
      data.birthYear = body.birthYear;
      data.gender = body.gender;
      data.subdistrict = body.address.subdistrict;
      data.district = body.address.district;
      data.city = body.address.city;
      data.platform = body.platform || req.query.platform || 'doctormeios'
    };

    function checkUserEmailExists(email) {
      return when.promise(function (resolve, reject) {
        DBService.select('users', 'email', [
            { field: 'email = $', value: email }
          ])
          .then(function(result) {
            resolve(result.rows.length !== 0);
          })
          .catch(function(err) {
            reject(err);
          });
      });
    };

    function createUser(data) {
      return when.promise(function (resolve, reject) {
        passgen(data.password).hash(sails.config.session.secret, function (err, hashedPassword) {
          if (err) return reject(err);

          DBService.insert('users', [
              { field: 'email', value: data.email },
              { field: 'password', value: hashedPassword },
              { field: 'tel', value: data.tel },
              { field: 'gender', value: data.gender },
              { field: '"birthYear"', value: data.birthYear },
              { field: 'subdistrict', value: data.subdistrict },
              { field: 'district', value: data.district },
              { field: 'city', value: data.city },
              { field: 'latitude', value: data.latitude },
              { field: 'longitude', value: data.longitude },
              { field: 'geom', value: data.geom },
              { field: 'platform', value: data.platform },
              { field: '"createdAt"', value: new Date() },
              { field: '"updatedAt"', value: new Date() }
            ])
            .then(function(result) {
              if (result.rows.length === 0) {
                reject(new Error('Could not insert data into database.'));
              }
              else {
                user = result.rows[0];
                resolve(result.rows[0]);
              }
            })
            .catch(function(err) {
              reject(err);
            });
        });
      });
    };

    function createAccessToken() {
      return when.promise(function (resolve, reject) {
        AccessTokenService.refresh(user.id)
          .then(function(_accessToken) {
            user.accessToken = _accessToken;
            resolve(_accessToken);
          })
          .catch(function (err) {
            reject(err);
          });
      });
    };

    function createUserDeviceToken() {
      if (req.body.deviceToken === '') {
        return UserService.removeDefaultUserDevice(user);
      }
      else if (req.body.deviceToken) {
        return UserService.setDevice(user, {
          id: req.body.deviceToken,
          platform: req.body.platform || req.query.platform || user.platform
        });
      }
    };

    function isSicksenseID(email) {
      return !email.match(/\@(www\.)?sicksense\.org$/);
    };

    function checkSicksenseEmailExists(email) {
      return when.promise(function (resolve, reject) {
        DBService.select('sicksense', 'email', [
            { field: 'email = $', value: email }
          ])
          .then(function (result) {
            resolve(result.rows.length !== 0);
          })
          .catch(function (err) {
            reject(err);
          });
      });
    };

    function createSicksenseID(data) {
      return when.promise(function (resolve, reject) {
        passgen(data.sicksense.password).hash(sails.config.session.secret, function (err, hashedPassword) {
          if (err) return reject(err);

          DBService.insert('sicksense', [
              { field: 'email', value: data.sicksense.email },
              { field: 'password', value: hashedPassword },
              { field: '"createdAt"', value: new Date() },
              { field: '"updatedAt"', value: new Date() }
            ])
            .then(function (result) {
              if (result.rows.length === 0) {
                reject(new Error('Could not insert data into database.'));
              }
              else {
                user.sicksense = result.rows[0];
              }
            })
            .then(function () {
              return DBService.insert('sicksense_users', [
                  { field: 'sicksense_id', value: user.sicksense.id },
                  { field: 'user_id', value: user.id }
                ])
            })
            .then(function () {
              resolve(user.sicksense);
            })
            .catch(function (err) {
              reject(err);
            });
        });
      });
    };

    function sendEmailVerification() {
      // check if subscribed account then send verification e-mail.
      var config = sails.config.mail.verificationEmail,
          subject = config.subject,
          body = config.body,
          from = config.from,
          to = user.sicksense.email,
          html = config.html;

      // Async here. User can still successful register if this method fail.
      return OnetimeTokenService.create('user.verifyEmail', user.sicksense.id, sails.config.onetimeToken.lifetime)
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
          sails.log.error(err);
          res.serverError(err);
        });
    };

    function subscribeUser() {
      if (req.body.subscribe && user.sicksense.id) {
        return EmailSubscriptionsService.subscribe(user.sicksense);
      }
    };

    function responseJSON() {
      return UserService.getUserJSON(user.id)
        .then(function (userJSON) {
          res.ok(userJSON);
        })
        .catch(function (err) {
          res.serverError(err);
        })
    };

    function validate() {
      return when.promise(function (resolve, reject) {
        req.checkBody('email', 'E-mail field is required').notEmpty();
        req.checkBody('email', 'E-mail field is not valid').isEmail();

        req.checkBody('password', 'Password field is required').notEmpty();
        req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);

        req.checkBody('uuid', 'UUID field is required').notEmpty();

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
        .then(updateUser)
        .then(function () {
          return DBService.select('sicksense_users', 'sicksense_id', [
              { field: 'user_id = $', value: req.user.id }
            ])
            .then(function (result) {
              if (result.rows.length === 0) return responseJSON();
              var sicksenseId = result.rows[0].sicksense_id;

              if (req.body.password) {
                passgen(req.body.password).hash(sails.config.session.secret, function(err, hashedPassword) {
                  updateSicksenseID(sicksenseId, hashedPassword);
                });
              }
              else {
                updateSicksenseID(sicksenseId);
              }
            })
            .catch(function (err) {
              res.serverError('Could not perform your request.');
            });
        })
        .catch(function (err) {
          sails.log.error(err);
        });
    });

    function responseJSON(extra) {
      extra = extra || {};
      return UserService.getUserJSON(req.user.id)
        .then(function (userJSON) {
          userJSON = _.assign(userJSON, extra);
          res.ok(userJSON);
          console.log('11111 return');
        })
        .catch(function (err) {
          res.serverError(err);
        });
    }

    function updateUser() {
      var now = (new Date()).getTime();

      var data = [
        { field: '"updatedAt" = $', value: new Date() }
      ];

      if (req.body.gender) {
        data.push({ field: '"gender" = $', value: req.body.gender });
      }
      if (req.body.birthYear) {
        data.push({ field: '"birthYear" = $', value: req.body.birthYear });
      }
      if (!_.isEmpty(req.body.address) && req.body.address.subdistrict) {
        data.push({ field: '"subdistrict" = $', value: req.body.address.subdistrict });
      }
      if (!_.isEmpty(req.body.address) && req.body.address.district) {
        data.push({ field: '"district" = $', value: req.body.address.district });
      }
      if (!_.isEmpty(req.body.address) && req.body.address.city) {
        data.push({ field: '"city" = $', value: req.body.address.city });
      }
      if (req.body.platform || req.query.platform) {
        data.push({ field: '"platform" = $', value: req.body.platform || req.query.platform });
      }

      var conditions = [
        { field: 'id = $', value: req.user.id }
      ];

      return DBService.update('users', data, conditions)
        .then(function (users) {
          var savedUser = users.rows[0];

          if (req.body.deviceToken === '') {
            return UserService.removeDefaultUserDevice(savedUser);
          }
          else if (req.body.deviceToken) {
            return UserService.clearDevices(req.user)
              .then(function () {
                return UserService.setDevice(savedUser, {
                  id: req.body.deviceToken,
                  platform: req.body.platform || req.query.platform || savedUser.platform
                });
              });
          }
        })
        .catch(function (err) {
          res.serverError('Could not perform your request1');
        });
    }

    function updateSicksenseID(id, password, subscribe) {
      var data = [
        { field: '"updatedAt" = $', value: new Date() },
      ];

      if (password) {
        data.push({ field: 'password = $', value: password });
      }

      var conditions = [
        { field: 'id = $', value: id }
      ];

      return DBService.update('sicksense', data, conditions)
        .then(function (users) {
          var promise = when.resolve();

          var savedUser = users.rows[0];
          if (req.body.subscribe) {
            console.log('11111 sub');
            promise = EmailSubscriptionsService.subscribe(savedUser).then(function () {
              return true;
            });
          } else {
            console.log('11111 unsub');
            promise = EmailSubscriptionsService.unsubscribe(savedUser).then(function () {
              return false;
            });
          }

          return promise.then(function (isSubscribed) {
            return responseJSON({ isSubscribed: isSubscribed });
          });
        })
        .catch(function (err) {
          sails.log.error(err);
          res.serverError('Could not perform your request2');
        });
    }

    function run(hashedPassword) {
      var now = (new Date()).getTime();

      var data = [
        { field: '"updatedAt" = $', value: new Date() }
      ];

      /*if (req.body.email) {
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
      }*/
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

          if (req.body.subscribe) {
            promise = EmailSubscriptionsService.subscribe(req.user).then(function () {
              return true;
            });
          } else {
            promise = EmailSubscriptionsService.unsubscribe(req.user).then(function () {
              return false;
            });
          }

          return promise.then(function (isSubscribed) {
            return UserService.getUserJSON(savedUser.id)
              .then(function (userJSON) {
                userJSON.isSubscribed = isSubscribed;
                res.ok(userJSON);
              })
              .catch(function (err) {
                res.serverError(err);
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

        // Updating email is not allowed.
        /*if (req.body.email) {
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
        }*/

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

      EmailSubscriptionsService.isSubscribed(req.user)
        .then(function (isSubscribed) {
          var user = UserService.formattedUser(req.user, {
            isSubscribed: isSubscribed
          });
          res.ok(user);
        })
        .catch(function (err) {
          res.serverError('Could not connect to database.');
        });
    });
  },

  forgotPassword: function(req, res) {
    var sicksenseID;
    var email = req.body.email;
    if (email) {
      pgconnect(function(err, client, done) {
        if (err) return res.serverError('Could not connect to database.');

        UserService.getSicksenseIDByEmail(email)
          .then(function (_sicksenseID) {
            sicksenseID = _sicksenseID;
          })
          .then(function () {
            return OnetimeTokenService.getByEmail(sicksenseID.email, 'user.resetPassword');
          })
          .then(function(token) {
            if (token) {
              return OnetimeTokenService.delete(token.user_id, token.type);
            }
            return when.resolve();
          })
          .then(function () {
            return OnetimeTokenService.create('user.resetPassword', sicksenseID.id, sails.config.onetimeToken.lifetime);
          })
          .then(function (token) {
            var siteURL = sails.config.common.siteURL;
            var resetURL = siteURL + '/reset-password.html?token=' + token.token;
            var subject = sails.config.mail.forgotPassword.subject;
            var from = sails.config.mail.forgotPassword.from;
            var to = sicksenseID.email;
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

        var sicksenseId = onetimeToken.user_id;

        OnetimeTokenService.delete(sicksenseId, onetimeToken.type)
          .then(function() {
            var password = req.body.password;
            return UserService.updatePassword(sicksenseId, password, true)
              .then(function () {
                res.ok({
                  message: 'Password has been updated.'
                });
              })
              .catch(function (err) {
                res.serverError(err);
              });
          })
          .catch(function(err) {
            return res.serverError(err)
          });
      })
      .catch(function(err) {
        return res.serverError(err)
      });

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
              res.ok({});
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
  },

  requestVerify: function(req, res) {
    req.checkBody('email', 'E-mail field is required').notEmpty();
    req.checkBody('email', 'E-mail field is not valid').isEmail();

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    // Check if e-mail exists
    UserService.doesSicksenseIDExist(req.body.email)
      .then(function (result) {
        // -- if yes
        if (result) {
          // load user object
          return DBService.select('sicksense_users', 'user_id', [
            { field: 'sicksense_id = $', value: result.id }
          ])
          .then(function (result) {
            return DBService.select('users', '*', [
              { field: 'id = $', value: result.rows[0].user_id }
            ]);
          })
          .then(function (result) {
            return when.resolve(result.rows[0]);
          });
        }
        // -- else
        else {
          // 1. show bad request.
          var error = new Error('E-mail address not found. Please register first');
          error.statusCode = 400;
          return when.reject(error);
        }
      })
      .then(function (user) {
        // 1. delete old token
        return OnetimeTokenService.delete(user.id, 'user.verifyEmail')
        // 2. generate the new one
        .then(function () {
          return OnetimeTokenService.create('user.verifyEmail', user.id, sails.config.onetimeToken.lifetime);
        })
        // 3. send e-mail
        .then(function (tokenObject) {
            // check if subscribed account then send verification e-mail.
            var config = sails.config.mail.verificationEmail,
                subject = config.subject,
                body = config.body,
                from = config.from,
                to = user.email,
                html = config.html;

            var url = req.getWWWUrl(sails.config.common.verifyEndpoint, {
              token: tokenObject.token
            });

            // substitute value in body, html
            body = body.replace(/\%token%/, url);
            html = html.replace(/\%token%/, url);

            return MailService.send(subject, body, from, to, html);
        });
      })
      .then(function () {
        res.ok({ status: 'ok' });
      })
      .catch(function (err) {
        if (err.statusCode == 400) {
          res.badRequest(err);
        }
        else {
          sails.log.error('UsersController.requestVerify()::', err);
          res.serverError('Server error, Cannot send verification e-mail', err);
        }
      });
  },

  changePassword: function(req, res) {
    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, accessToken) {
      if (err) {
        sails.log.error(err);
        return res.serverError(new Error("Could not perform your request"));
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden(new Error("You can not get another user's password"));
      }

      validate()
        .then(function () {
          passgen(req.body.oldPassword).hash(sails.config.session.secret, function (err, hashedPassword) {
            if (err) return res.serverError('Could not perform your request.');
            var joinTable = 'sicksense_users su LEFT JOIN sicksense s ON su.sicksense_id = s.id';
            return DBService.select(joinTable, 's.*', [
                { field: 'su.user_id = $', value: accessToken.userId },
                { field: 's.password = $', value: hashedPassword }
              ])
              .then(function (result) {
                if (result.rows.length === 0) return res.forbidden('Unauthorized');
                var sicksenseId = result.rows[0].id;
                var newPassword = req.body.newPassword;
                return UserService.updatePassword(sicksenseId, newPassword, true)
                  .then(responseJSON)
                  .catch(function (err) {
                    sails.log.error(err);
                    res.serverError('Could not perform your request.44');
                  });
              })
              .catch(function (err) {
                res.serverError('Could not perform your request.33');
              });
          });
        })
        .catch(function (err) {
          res.serverError('Could not perform your request.11');
        });
    });

    function responseJSON() {
      return UserService.getUserJSON(req.user.id)
        .then(function (userJSON) {
          res.ok(userJSON);
        })
        .catch(function (err) {
          res.serverError('Could not perform your request.22');
        })
    }

    function validate() {
      return when.promise(function(resolve, reject) {
        req.checkBody('oldPassword', 'Old password is required').notEmpty();
        req.checkBody('newPassword', 'New password is required').notEmpty();

        var errors = req.validationErrors();
        var paramErrors = req.validationErrors(true);
        if (errors) {
          res.badRequest(_.first(errors).msg, paramErrors);
          return reject(errors);
        }

        resolve();
      });
    }
  }

};
