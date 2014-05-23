var pg = require('pg');

module.exports = function(req, res, next) {
  var accessToken;
  if (accessToken = req.query.accessToken) {
    AccessToken.findOne({ token: accessToken }).exec(function(err, accessToken) {
      if (err) return res.serverError("Can not load access token, please try again");
      if (!accessToken) return res.forbidden("Access token is not valid");
      // Check if access_token is expired.
      if (accessToken.expired < new Date()) {
        return res.forbidden("Access token is already expired");
      }
      else {
        pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
          if (err) return res.serverError(new Error("Could not connect to database"));
          UserService.getUserByID(client, accessToken.userId)
            .then(function(user) {
              pgDone();
              req.user = user;
              next();
            })
            .finally(function() {
              pgDone();
            });
        });
      }
    });
  }
  else {
    sails.log.info("Attempt to access without accessToken provided");
    return res.forbidden("Unauthorized");
  }
};
