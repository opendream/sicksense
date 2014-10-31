module.exports = function(req, res, next) {
  var accessToken;
  if (accessToken = req.query.accessToken) {
    AccessToken.findOne({ token: accessToken }).exec(function(err, accessToken) {
      if (err) return res.serverError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
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
          if (err) return res.serverError(new Error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"));
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
