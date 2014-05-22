var pg = require('pg');

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

    pg.connect(connectionString, function(err, client, pgDone) {
      if (err) return res.serverError("Could not connect to database");

      var user;
      var accessToken;

      UserService.getUserByEmailPassword(client, email, password)
        .then(function(_user) {
          user = _user;
          return UserService.getAccessToken(client, user.id, true);
        })
        .then(function(accessToken) {
          res.ok(UserService.getUserJSON(user, { accessToken: accessToken.token }));
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
        });
    });
  }

};
