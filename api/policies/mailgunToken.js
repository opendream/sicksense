module.exports = function(req, res, next) {
    if (req.query.token && req.query.token == sails.config.mailgun.token) {
        return next();
    }
    return res.forbidden("Unauthorized");
};
