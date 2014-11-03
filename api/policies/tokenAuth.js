
module.exports = function(req, res, next) {
  var accessToken;
  if (accessToken = req.query.accessToken) {
    AccessToken.findOne({ token: accessToken }).exec(function(err, accessToken) {
      if (err) return res.serverError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      if (!accessToken) return res.forbidden("Access token ไม่ถูกต้อง");
      // Check if access_token is expired.
      if (accessToken.expired < new Date()) {
        return res.forbidden("Access token หมดอายุ");
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
            res.serverError(new Error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'));
          });
      }
    });
  }
  else {
    sails.log.info("Attempt to access without accessToken provided");
    return res.forbidden("Unauthorized");
  }
};
