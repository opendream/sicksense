module.exports = function(req, res, next) {
  var accessToken;
  if (accessToken = req.query.accessToken) {
    AccessToken.findOne({ token: accessToken }).exec(function(err, accessToken) {
      if (err) return res.serverError("Can not load access token, please try again");
      if (!accessToken) {
        return next();
      }

      // Check if access_token is expired.
      if (accessToken.expired < new Date()) {
        return next();
      }
      else {
        var now = (new Date()).getTime();
        pgconnect(function(err, client, pgDone) {
          sails.log.debug('[optionalTokenAuth]', now);
          if (err) return res.serverError(new Error("Could not connect to database"));
          UserService.getUserByID(client, accessToken.userId)
            .then(function(user) {
              req.user = user;
            })
            .finally(function() {
              pgDone();
              next();
              sails.log.debug('[optionalTokenAuth]', now);
            });
        });
      }
    });
  }
  else {
    next();
  }
};
