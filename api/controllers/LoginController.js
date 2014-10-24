var when = require('when');
var passgen = require('password-hash-and-salt');

module.exports = {

  index: function(req, res) {
    req.checkBody('email', 'E-mail field is required').notEmpty();
    req.checkBody('email', 'E-mail field is not valid').isEmail();

    req.checkBody('password', 'Password field is required').notEmpty();
    req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);

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
      if (err) return res.serverError("Could not connect to database");
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
          if (err.statusCode == 403) {
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
    req.checkBody('email', 'E-mail field is required').notEmpty();
    req.checkBody('email', 'E-mail field is not valid').isEmail();

    req.checkBody('password', 'Password field is required').notEmpty();
    req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);

    req.checkBody('uuid', 'UUID field is required.').notEmpty();

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
          { field: 'email = $', value: email },
          { field: 'password = $', value: hashedPassword }
        ])
        .then(function (result) {

          // Incorrect login.
          if (result.rows.length === 0) {

            // User exists.
            if (user) {
              return DBService.select('sicksense', '*', [
                  { field: 'email = $', value: email }
                ])
                .then(function (result) {
                  if (result.rows.length === 0) {
                    // TODO send email verify.
                    return DBService.insert('sicksense', [
                        { field: 'email', value: email },
                        { field: 'password', value: hashedPassword },
                        { field: '"createdAt"', value: new Date() },
                        { field: '"updatedAt"', value: new Date() }
                      ])
                      .then(function (result) {
                        sicksenseID = result.rows[0];
                      })
                      .then(connectSicksenseIDAndUser)
                      .catch(raiseError);
                  }

                  return res.forbidden('Invalid email and password.');
                })
                .catch(raiseError);
            }
            // User not found.
            else {
              return res.forbidden('Invalid email and password.');
            }
          }

          // Found sicksense ID.
          sicksenseID = result.rows[0];

          // User not found.
          if (!user) {

            // Find latest connected user with sicksense id.
            var joinTable = 'sicksense_users su LEFT JOIN users u ON su.user_id = u.id';
            DBService.select(joinTable, 'u.*', [
                { field: 'su.sicksense_id = $', value: sicksenseID.id }
              ], 'ORDER BY u.id DESC LIMIT 1 OFFSET 0')
              .then(function (result) {
                var latest = {};
                if (result.rows.length === 1) {
                  latest = result.rows[0];
                }

                passgen(uuid).hash(sails.config.session.secret, function (err, hashedUUID) {
                  if (err) return res.serverError(err);

                  // Create new user.
                  DBService.insert('users', [
                      { field: 'email', value: uuid + '@sicksense.org' },
                      { field: 'password', value: hashedUUID },
                      { field: 'tel', value: latest.tel },
                      { field: 'gender', value: latest.gender },
                      { field: '"birthYear"', value: latest.birthYear },
                      { field: 'subdistrict', value: latest.subdistrict },
                      { field: 'district', value: latest.district },
                      { field: 'city', value: latest.city },
                      { field: 'latitude', value: latest.latitude },
                      { field: 'longitude', value: latest.longitude },
                      { field: 'geom', value: latest.geom },
                      { field: '"createdAt"', value: new Date() },
                      { field: '"updatedAt"', value: new Date() }
                    ])
                    .then(function (result) {
                      if (result.rows.length === 0) {
                        return res.serverError('Could perform the request.');
                      }
                      user = result.rows[0];
                      connectSicksenseIDAndUser();
                    })
                    .catch(raiseError);
                });
              })
              .catch(raiseError);
          }
          else {
            return connectSicksenseIDAndUser();
          }
        })
        .catch(raiseError);

    });

    function connectSicksenseIDAndUser() {
      return DBService.select('sicksense_users', '*', [
        { field: 'sicksense_id = $', value: sicksenseID.id },
        { field: 'user_id = $', value: user.id }
      ])
      .then(function (result) {
        if (result.rows.length === 0) {
          return DBService.insert('sicksense_users', [
              { field: 'sicksense_id', value: sicksenseID.id },
              { field: 'user_id', value: user.id }
            ])
            .then(refreshAccessToken)
            .catch(raiseError);
        }
        else {
          return refreshAccessToken();
        }
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

    function raiseError(err) {
      return res.serverError(err);
    }
  },

  unlink: function(req, res) {
    res.ok({});
  }

};
