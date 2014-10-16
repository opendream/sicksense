var when = require('when');

module.exports = {

  validate: function(req, res) {

    validate()
      .then(function() {
        var token = req.body.token;
        var type = req.body.type;
        OnetimeTokenService.getByToken(token)
          .then(function(tokenObject) {
            var error = new Error('Invalid token.');
            var paramErrors = {
              token: { msg: 'Invalid token.' }
            };

            if (!tokenObject) {
              return res.badRequest(error, paramErrors);
            }

            if (tokenObject.type !== type) {
              return res.badRequest(error, paramErrors);
            }

            if (tokenObject.expired < new Date()) {
              paramErrors.token.msg = 'Token is already expired.';
              return res.badRequest(error, paramErrors);
            }

            return res.ok({
              success: true
            });
          })
          .catch(function(err) {
            res.serverError(err);
          });
      })
      .catch(function(err) {
        res.serverError(err);
      });

    function validate() {
      return when.promise(function(resolve, reject) {
        req.checkBody('token', 'Token is required').notEmpty();
        req.checkBody('type', 'Password is required').notEmpty();

        var errors = req.validationErrors();
        var paramErrors = req.validationErrors(true);
        if (errors) {
          res.badRequest(_.first(errors).msg, paramErrors);
          return reject(errors);
        }

        resolve();
      });
    };

  }

};
