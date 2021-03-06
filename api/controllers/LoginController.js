var when = require('when');
var passgen = require('password-hash-and-salt');

module.exports = {

  index: function(req, res) {
    req.checkBody('email', 'กรุณากรอกอีเมล').notEmpty();
    req.checkBody('email', 'กรุณากรอกอีเมลให้ถูกต้อง').isEmail();

    req.checkBody('password', 'กรุณากรอกรหัสผ่าน').notEmpty();
    req.checkBody('password', 'กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร').isLength(8);

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var connectionString = sails.config.connections.postgresql.connectionString;
    var email = req.body.email;
    var password = req.body.password;

    var now = (new Date()).getTime();
    pgconnect(function(err, client, pgDone) {
      if (err) return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      sails.log.debug('[LoginController:index]', now);

      var user;
      var accessToken;

      UserService.getUserByEmailPassword(client, email, password)
        .then(function(_user) {
          user = _user;
          return UserService.getAccessToken(client, user.id, true);
        })
        .then(function(accessToken) {
          var promise = when.resolve();

          if (req.body.deviceToken === '') {
            promise = UserService.removeDefaultUserDevice(user);
          }
          else if (req.body.deviceToken) {
            promise = UserService.clearDevices(req.user)
              .then(function () {
                return UserService.setDevice(user, {
                  id: req.body.deviceToken,
                  platform: req.body.platform || req.query.platform || user.platform
                });
              });
          }

          return promise.then(function () {
            UserService.getDefaultDevice(user)
              .then(function (device) {
                var extra = {
                  accessToken: accessToken.token
                };
                if (device) {
                  extra.deviceToken = device.id;
                }
                res.ok(UserService.getUserJSON(user, extra));
              });
          });
        })
        .catch(function(err) {
          if (err.status == 403) {
            res.forbidden(err);
          }
          else {
            res.serverError(err);
          }
        })
        .finally(function() {
          pgDone();
          sails.log.debug('[LoginController:index]', now);
        });
    });
  },

  connect: function(req, res) {
    req.checkBody('email', 'กรุณากรอกอีเมล').notEmpty();
    req.checkBody('email', 'กรุณากรอกอีเมลให้ถูกต้อง').isEmail();

    req.checkBody('password', 'กรุณากรอกรหัสผ่าน').notEmpty();
    req.checkBody('password', 'กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร').isLength(8);

    req.checkBody('uuid', 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง').notEmpty();

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var email = req.body.email;
    var password = req.body.password;
    var uuid = req.body.uuid;
    var user = req.user;
    var sicksenseID;

    passgen(password).hash(sails.config.session.secret, function (err, hashedPassword) {
      if (err) return raiseError(err);

      // Try to login.
      DBService.select('sicksense', '*', [
          { field: 'LOWER(email) = LOWER($)', value: email.toLowerCase() },
          { field: 'password = $', value: hashedPassword }
        ])
        .then(function (result) {

          // Incorrect login.
          if (result.rows.length === 0) {

            // User exists.
            if (user) {
              return DBService.select('sicksense', '*', [
                  { field: 'LOWER(email) = LOWER($)', value: email.toLowerCase() }
                ])
                .then(function (result) {
                  if (result.rows.length === 0) {
                    return DBService.insert('sicksense', [
                        { field: 'email', value: email.toLowerCase() },
                        { field: 'password', value: hashedPassword },
                        { field: '"createdAt"', value: new Date() },
                        { field: '"updatedAt"', value: new Date() }
                      ])
                      .then(function (result) {
                        sicksenseID = result.rows[0];
                      })
                      .then(sendEmailVerification)
                      .then(connectSicksenseIDAndUser)
                      .catch(raiseError);
                  }

                  return res.forbidden('อีเมลหรือรหัสผ่านของคุณไม่ถูกต้อง');
                })
                .catch(raiseError);
            }
            // User not found.
            else {
              return res.forbidden('อีเมลหรือรหัสผ่านของคุณไม่ถูกต้อง');
            }
          }

          // Found sicksense ID.
          sicksenseID = result.rows[0];
          var sicksenseData = sicksenseID.data || {};

          if (sicksenseID.is_verify) {
            // User not found.
            if (!user) {

              // Duplicate user from data column.
              passgen(uuid).hash(sails.config.session.secret, function (err, hashedUUID) {
                if (err) return res.serverError(err);

                var platform = req.body.platform || req.query.platform || 'doctormeios';

                var email = ('' + uuid + '@sicksense.com').toLowerCase();

                var conditions = [
                  { field: 'LOWER(email) = LOWER($)', value: email }
                ];

                var dataToInsert = [
                  { field: 'email', value: email },
                  { field: 'password', value: hashedUUID },
                  { field: 'tel', value: sicksenseData.tel },
                  { field: 'gender', value: sicksenseData.gender },
                  { field: '"birthYear"', value: sicksenseData.birthYear },
                  { field: 'subdistrict', value: sicksenseData.subdistrict },
                  { field: 'district', value: sicksenseData.district },
                  { field: 'city', value: sicksenseData.city },
                  { field: 'latitude', value: sicksenseData.latitude },
                  { field: 'longitude', value: sicksenseData.longitude },
                  { field: 'geom', value: sicksenseData.geom },
                  { field: 'platform', value: platform },
                  { field: '"createdAt"', value: new Date() },
                  { field: '"updatedAt"', value: new Date() }
                ];

                var dataToUpdate = [
                  { field: '"updatedAt" = $', value: new Date() }
                ];

                // Create new user or update if exists.
                DBService.upsert('users', conditions, dataToInsert, dataToUpdate)
                  .then(function (result) {
                    if (result.rows.length === 0) {
                      return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
                    }
                    user = result.rows[0];
                    connectSicksenseIDAndUser();
                  })
                  .catch(raiseError);
              });
            }
            else {
              return connectSicksenseIDAndUser();
            }
          }
          else {
            var error = new Error('กรุณาตรวจสอบอีเมลเพื่อยืนยันการใช้งาน Sicksense ID');
            error.subType = 'unverified_email';
            return res.forbidden(error);
          }
        })
        .catch(raiseError);

    });

    function connectSicksenseIDAndUser() {
      return DBService.delete('sicksense_users', [
        { field: 'user_id = $', value: user.id }
      ])
      .then(function (result) {
        return DBService.insert('sicksense_users', [
            { field: 'sicksense_id', value: sicksenseID.id },
            { field: 'user_id', value: user.id }
        ])
        .then(refreshAccessToken)
        .catch(raiseError);
      })
      .catch(raiseError);
    }

    function refreshAccessToken() {
      return AccessTokenService.refresh(user.id)
        .then(function (accessToken) {
          return UserService.getUserJSON(user.id);
        })
        .then(function (userJSON) {
          return res.ok(userJSON);
        })
        .catch(raiseError);
    }

    function sendEmailVerification() {
      // check if subscribed account then send verification e-mail.
      var config = sails.config.mail.verification,
          subject = config.subject,
          text = config.text,
          from = config.from,
          to = sicksenseID.email,
          html = config.html;

      // Async here. User can still successful register if this method fail.
      return OnetimeTokenService.create('user.verifyEmail', sicksenseID.id, sails.config.onetimeToken.lifetime)
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

    function raiseError(err) {
      return res.serverError(err);
    }
  },

  unlink: function(req, res) {
    req.checkBody('uuid', 'เกิดข้อผิดพลาด ไม่สามารถยกเลิกการเชื่อมต่อได้').notEmpty();

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    DBService.delete('sicksense_users', [
        { field: 'user_id = $', value: req.user.id }
      ])
      .then(function (result) {
        return UserService.getUserJSON(req.user.id);
      })
      .then(function (userJSON) {
        res.ok(userJSON);
      })
      .catch(function (err) {
        res.serverError('เกิดข้อผิดพลาด ไม่สามารถยกเลิกการเชื่อมต่อได้');
      });
  }

};
