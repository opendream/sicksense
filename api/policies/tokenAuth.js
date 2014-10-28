
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
        var now = (new Date()).getTime();
        sails.log.debug('[tokenAuth]', now);
        UserService.getUserJSON(accessToken.userId)
          .then(function (userJSON) {
            sails.log.debug('[tokenAuth]', now);
            req.user = userJSON;
            next();
          })
          .catch(function (err) {
            sails.log.debug('[tokenAuth]', now);
            res.serverError(new Error('Could not connect to database.'));
          });
      }
    });
  }
  else {
    sails.log.info("Attempt to access without accessToken provided");
    return res.forbidden("Unauthorized");
  }
};
