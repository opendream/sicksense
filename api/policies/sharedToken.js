
module.exports = function(req, res, next) {
  if (req.query.token) {
    var found = _.find(sails.config.sharedTokens, function (item) {
      return item.token == req.query.token;
    });

    if (found) {
      return next();
    }
  }

  return res.forbidden("Unauthorized");
};
