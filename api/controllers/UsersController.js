
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
          var promise = when.resolve();

          if (!exists) {
            promise = createUser(data);
          }
          else if (exists && data.sicksense && data.sicksense.email) {
            user = exists;
            promise = unlinkOldDevices(user.id);
          }
          else {
            return res.conflict('อุปกรณ์นี้ได้ทำการลงทะเบียนไว้แล้ว ไม่จำเป็นต้องลงทะเบียนอีก');
          }

          return promise
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
                    var promise = when.resolve();
                    if (exists) {
                      // try to login first.
                      promise = checkSicksenseEmailPassword(data)
                        .then(function (result) {
                          if (result) {
                            if (result.is_verify) {
                              user.sicksense = result;

                              return DBService.insert('sicksense_users', [
                                { field: 'sicksense_id', value: user.sicksense.id },
                                { field: 'user_id', value: user.id }
                              ])
                              .then(function () {
                                return responseJSON();
                              });
                            }
                            else {
                              var error = new Error('กรุณายืนยันอีเมล');
                              error.subType = 'unverified_email';
                              return res.forbidden(error);
                            }
                          }
                          else {
                            // if password not correct.
                            return res.conflict('อีเมลนี้ถูกใช้แล้ว กรุณาใช้อีเมลอื่น');
                          }
                        })
                        .catch(function (err) {
                          res.serverError(err);
                        });
                    }
                    else {
                      promise = createSicksenseID(data)
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


                    return promise;
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
    }

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

      data.email = body.uuid + '@sicksense.com';
      data.password = body.uuid;
      data.tel = body.tel;
      data.birthYear = body.birthYear;
      data.gender = body.gender;
      data.subdistrict = body.address.subdistrict;
      data.district = body.address.district;
      data.city = body.address.city;
      data.platform = body.platform || req.query.platform || 'doctormeios';
    }

    function checkUserEmailExists(email) {
      return when.promise(function (resolve, reject) {
        DBService.select('users', '*', [
            { field: 'email = $', value: email }
          ])
          .then(function(result) {
            resolve(result.rows[0]);
          })
          .catch(function(err) {
            reject(err);
          });
      });
    }

    function unlinkOldDevices(userId) {
      return DBService.delete('sicksense_users', [
        { field: 'user_id = $', value: userId }
      ]);
    }

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
                reject(new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'));
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
      return !email.match(/\@(www\.)?sicksense\.com$/);
    }

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
    }

    function checkSicksenseEmailPassword(data) {
      var email = data.sicksense.email,
          password = data.sicksense.password;

      return when.promise(function (resolve, reject) {
        passgen(password).hash(sails.config.session.secret, function (err, hashedPassword) {
          if (err) return raiseError(err);

          // Try to login.
          DBService.select('sicksense', '*', [
              { field: 'email = $', value: email },
              { field: 'password = $', value: hashedPassword }
            ])
            .then(function (result) {
              resolve(result.rows[0]);
            })
            .catch(function (err) {
              reject(err);
            });

        });
      });
    }

    function createSicksenseID(data) {
      return when.promise(function (resolve, reject) {
        passgen(data.sicksense.password).hash(sails.config.session.secret, function (err, hashedPassword) {
          if (err) return reject(err);

          var sicksenseData = {
            tel: user.tel,
            gender: user.gender,
            birthYear: user.birthYear,
            subdistrict: user.subdistrict,
            district: user.district,
            city: user.city,
            latitude: user.latitude,
            longitude: user.longitude,
            geom: user.geom
          };

          DBService.insert('sicksense', [
              { field: 'email', value: data.sicksense.email },
              { field: 'password', value: hashedPassword },
              { field: 'data', value: sicksenseData },
              { field: '"createdAt"', value: new Date() },
              { field: '"updatedAt"', value: new Date() }
            ])
            .then(function (result) {
              if (result.rows.length === 0) {
                reject(new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'));
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
      var config = sails.config.mail.verification,
          subject = config.subject,
          text = config.text,
          from = config.from,
          to = user.sicksense.email,
          html = config.html;

      // Async here. User can still successful register if this method fail.
      return OnetimeTokenService.create('user.verifyEmail', user.sicksense.id, sails.config.onetimeToken.lifetime)
        .then(function (tokenObject) {
          var url = req.getWWWUrl(sails.config.common.verifyEndpoint, {
            token: tokenObject.token
          });

          // substitute value in text, html
          text = text.replace(/\%verification_url%/, url);
          html = html.replace(/\%verification_url%/, url);

          return MailService.send(subject, text, from, to, html);
        })
        .catch(function (err) {
          sails.log.error(new Error('Can not send verification e-mail'), err);
          sails.log.error(err);
          res.serverError('ไม่สามารถส่งอีเมลยืนยันได้');
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
        req.checkBody('email', 'กรุณากรอกอีเมล').notEmpty();
        req.checkBody('email', 'กรุณากรอกอีเมลให้ถูกต้อง').isEmail();

        req.checkBody('password', 'กรุณากรอกรหัสผ่าน').notEmpty();
        req.checkBody('password', 'กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร').isLength(8, 64);

        req.checkBody('uuid', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง').notEmpty();

        if (req.body.gender) {
          req.checkBody('gender', 'กรุณาเลือกเพศ').isIn(['male', 'female']);
        }

        if (req.body.birthYear) {
          req.sanitize('birthYear').toInt();
          req.checkBody('birthYear', 'กรุณาเลือกปีเกิด').notEmpty();
          req.checkBody('birthYear', 'กรุณาเลือกปีเกิดให้ถูกต้อง').isInt();
          req.checkBody('birthYear', 'กรุณาเลือกปีเกิดให้ถูกต้อง').isBetween(1900, (new Date()).getUTCFullYear());
        }

        if (!_.isEmpty(req.body.address)) {
          req.checkBody('address.subdistrict', 'กรุณาเลือกตำบล').notEmpty();
          req.checkBody('address.district', 'กรุณาเลือกอำเภอ').notEmpty();
          req.checkBody('address.city', 'กรุณาเลือกจังหวัด').notEmpty();
        }

        if (!_.isEmpty(req.body.location)) {
          req.sanitize('location.latitude').toFloat();
          req.sanitize('location.longitude').toFloat();
          req.checkBody('location.latitude', 'กรุณาเลือกพิกัดให้ถูกต้อง').notEmpty();
          req.checkBody('location.latitude', 'กรุณาเลือกพิกัดให้ถูกต้อง').isFloat();
          req.checkBody('location.latitude', 'กรุณาเลือกพิกัดให้ถูกต้อง').isBetween(-90, 90);
          req.checkBody('location.longitude', 'กรุณาเลือกพิกัดให้ถูกต้อง').notEmpty();
          req.checkBody('location.longitude', 'กรุณาเลือกพิกัดให้ถูกต้อง').isFloat();
          req.checkBody('location.longitude', 'กรุณาเลือกพิกัดให้ถูกต้อง').isBetween(-180, 180);
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
                err = 'กรุณาเลือกที่อยู่ให้ถูกต้อง';
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
    var accessToken, user;

    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, _accessToken) {
      if (err) {
        sails.log.error(err);
        return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }

      accessToken = _accessToken;

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden('ไม่สามารถแก้ไขข้อมูลผู้อื่นได้');
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
              res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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
          user = users.rows[0];

          if (req.body.deviceToken === '') {
            return UserService.removeDefaultUserDevice(user);
          }
          else if (req.body.deviceToken) {
            return UserService.clearDevices(req.user)
              .then(function () {
                return UserService.setDevice(user, {
                  id: req.body.deviceToken,
                  platform: req.body.platform || req.query.platform || user.platform
                });
              });
          }
        })
        .catch(function (err) {
          res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    }

    function updateSicksenseID(id, password, subscribe) {
      var data = [
        { field: '"updatedAt" = $', value: new Date() },
      ];

      data.push({
        field: 'data = $',
        value: {
          tel: user.tel,
          gender: user.gender,
          birthYear: user.birthYear,
          subdistrict: user.subdistrict,
          district: user.district,
          city: user.city,
          latitude: user.latitude,
          longitude: user.longitude,
          geom: user.geom
        }
      });

      // if (password) {
      //   data.push({ field: 'password = $', value: password });
      // }

      var conditions = [
        { field: 'id = $', value: id }
      ];

      return DBService.update('sicksense', data, conditions)
        .then(function (users) {
          var promise = when.resolve();

          var savedUser = users.rows[0];
          if (req.body.subscribe) {
            promise = EmailSubscriptionsService.subscribe(savedUser).then(function () {
              return true;
            });
          } else {
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
          res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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
          return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        }); // end DBService.update()
    }

    function validate() {
      return when.promise(function (resolve, reject) {

        if (req.body.password) {
          req.checkBody('password', 'กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร').isLength(8);
        }

        if (req.body.gender) {
          req.checkBody('gender', 'กรุณาเลือกเพศ').isIn(['male', 'female']);
        }

        if (req.body.birthYear) {
          req.sanitize('birthYear').toInt();
          req.checkBody('birthYear', 'กรุณาเลือกปีเกิด').notEmpty();
          req.checkBody('birthYear', 'กรุณาเลือกปีเกิดให้ถูกต้อง').isInt();
          req.checkBody('birthYear', 'กรุณาเลือกปีเกิดให้ถูกต้อง').isBetween(1900, (new Date()).getUTCFullYear());
        }

        if (!_.isEmpty(req.body.address)) {
          req.checkBody('address.subdistrict', 'กรุณาเลือกตำบล').notEmpty();
          req.checkBody('address.district', 'กรุณาเลือกอำเภอ').notEmpty();
          req.checkBody('address.city', 'กรุณาเลือกจังหวัด').notEmpty();
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
                    err = "กรุณาเลือกที่อยู่ให้ถูกต้อง";

                    res.badRequest(err, {
                      address: {
                        msg: err
                      }
                    });
                  }
                  else {
                    sails.log.error(err);
                    res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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
        return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden('ไม่สามารถดึงข้อมูลได้');
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
          return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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
            return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
          }

          client.query(countQuery, countValues, function(err, countResult) {
            pgDone();
            sails.log.debug('[UsersController:userReports()]', now);

            if (err) {
              sails.log.error(err);
              return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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
        return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden('ไม่สามารถดึงข้อมูลได้');
      }

      var user;
      UserService.getUserJSON(req.user.id)
        .then(function (userJSON) {
          user = userJSON;
          return EmailSubscriptionsService.isSubscribed({id: user.sicksenseId})
        })
        .then(function (isSubscribed) {
          user.isSubscribed = isSubscribed;
          res.ok(user);
        })
        .catch(function (err) {
          res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    });
  },

  forgotPassword: function(req, res) {
    var sicksenseID;
    var email = req.body.email;
    if (email) {
      pgconnect(function(err, client, done) {
        if (err) return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');

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
            var text = sails.config.mail.forgotPassword.text.replace(/\%reset_password_url\%/g, resetURL);
            var html = sails.config.mail.forgotPassword.html.replace(/\%reset_password_url\%/g, resetURL);
            return MailService.send(subject, text, from, to, html);
          })
          .then(function() {
            return res.ok({
              'message': 'วิธีตั้งค่ารหัสผ่านใหม่ถูกส่งไปยังเมล ' + email + 'แล้ว'
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
          return res.forbidden('ไม่ได้สามารถตั้งค่ารหัสผ่านใหม่ได้ เนื่องจากลิงก์หมดอายุ');
        }

        var sicksenseId = onetimeToken.user_id;

        OnetimeTokenService.delete(sicksenseId, onetimeToken.type)
          .then(function() {
            var password = req.body.password;
            return UserService.updatePassword(sicksenseId, password, true)
              .then(function () {
                res.ok({
                  message: 'ตั้งค่ารหัสผ่านใหม่สำเร็จ'
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
        req.checkBody('token', 'ไม่ได้สามารถตั้งค่ารหัสผ่านใหม่ได้ เนื่องจากข้อมูลไม่ครบถ้วน').notEmpty();
        req.checkBody('password', 'กรุณากรอกรหัสผ่าน').notEmpty();
        req.checkBody('password', 'กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร').isLength(8, 64);

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
    req.check('token', 'ไม่ได้สามารถยืนยันอีเมลได้ เนื่องจากข้อมูลไม่ครบถ้วน').notEmpty();

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
              res.ok();
            })
            .catch(function (err) {
              sails.log.error('UsersController.verify()::', err);
              res.serverError('ไม่ได้สามารถยืนยันอีเมลได้ กรุณาลองใหม่อีกครั้ง');
            });

        }
        else {
          res.forbidden('ไม่ได้สามารถยืนยันอีเมลได้ เนื่องจากลิงก์หมดอายุ');
        }
      });
  },

  requestVerify: function(req, res) {
    req.checkBody('email', 'กรุณากรอกอีเมล').notEmpty();
    req.checkBody('email', 'กรุณากรอกอีเมลให้ถูกต้อง').isEmail();

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var data = {};

    // Check if e-mail exists
    UserService.doesSicksenseIDExist(req.body.email)
      // check if this e-mail is already verified.
      .then(function (result) {
        data.sicksense = result;

        if (data.sicksense.is_verify) {
          var error = new Error('This e-mail is already verified');
          error.status = 400;
          error.subType = 'email_is_already_verified';
          return when.reject(error);
        }
      })
      .then(function () {
        // -- if yes
        if (data.sicksense) {
          return when.resolve();
        }
        // -- else
        else {
          // 1. show bad request.
          var error = new Error('ไม่พบอีเมลในระบบ');
          error.status = 400;
          return when.reject(error);
        }
      })
      .then(function () {
        // 1. delete old token
        return OnetimeTokenService.delete(data.sicksense.id, 'user.verifyEmail')
        // 2. generate the new one
        .then(function () {
          return OnetimeTokenService.create('user.verifyEmail', data.sicksense.id, sails.config.onetimeToken.lifetime);
        })
        // 3. send e-mail
        .then(function (tokenObject) {
            // check if subscribed account then send verification e-mail.
            var config = sails.config.mail.verification,
                subject = config.subject,
                text = config.text,
                from = config.from,
                to = data.sicksense.email,
                html = config.html;

            var url = req.getWWWUrl(sails.config.common.verifyEndpoint, {
              token: tokenObject.token
            });

            // substitute value in text, html
            text = text.replace(/\%verification_url%/, url);
            html = html.replace(/\%verification_url%/, url);

            return MailService.send(subject, text, from, to, html);
        });
      })
      .then(function () {
        res.ok({ status: 'ok' });
      })
      .catch(function (err) {
        if (err.status == 400) {
          res.badRequest(err);
        }
        else {
          sails.log.error('UsersController.requestVerify()::', err);
          res.serverError('ไม่สามารถส่งอีเมลยืนยันได้', err);
        }
      });
  },

  changePassword: function(req, res) {
    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, accessToken) {
      if (err) {
        sails.log.error(err);
        return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden('ไม่สามารถแก้ไขรหัสผ่านของผู้อื่นได้');
      }

      validate()
        .then(function () {
          passgen(req.body.oldPassword).hash(sails.config.session.secret, function (err, hashedPassword) {
            if (err) return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
            var joinTable = 'sicksense_users su LEFT JOIN sicksense s ON su.sicksense_id = s.id';
            return DBService.select(joinTable, 's.*', [
                { field: 'su.user_id = $', value: accessToken.userId },
                { field: 's.password = $', value: hashedPassword }
              ])
              .then(function (result) {
                if (result.rows.length === 0) return res.forbidden('รหัสผ่านเก่าไม่ถูกต้อง');
                var sicksenseId = result.rows[0].id;
                var newPassword = req.body.newPassword;
                return UserService.updatePassword(sicksenseId, newPassword, true)
                  .then(responseJSON)
                  .catch(function (err) {
                    sails.log.error(err);
                    res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
                  });
              })
              .catch(function (err) {
                res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
              });
          });
        })
        .catch(function (err) {
          res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    });

    function responseJSON() {
      return UserService.getUserJSON(req.user.id)
        .then(function (userJSON) {
          res.ok(userJSON);
        })
        .catch(function (err) {
          res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    }

    function validate() {
      return when.promise(function(resolve, reject) {
        req.checkBody('oldPassword', 'กรุณากรอกรหัสผ่านเก่า').notEmpty();
        req.checkBody('newPassword', 'กรุณากรอกรหัสผ่านใหม่').notEmpty();

        req.checkBody('oldPassword', 'กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร').isLength(8, 64);
        req.checkBody('newPassword', 'กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร').isLength(8, 64);

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
