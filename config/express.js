var expressValidator = require('express-validator');
expressValidator.validator.extend('isBetween', function(value, min, max) {
  return min <= value && value <= max;
});

module.exports.express = {
  middleware: {
    expressValidator: expressValidator()
  }
};
