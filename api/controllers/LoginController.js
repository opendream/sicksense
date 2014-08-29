var when = require('when');

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
  }

};
