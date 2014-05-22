var expressValidator = require('express-validator');

// Quick fix
// @see: https://github.com/chriso/validator.js/issues/268

expressValidator.validator.extend = function (name, fn) {
  expressValidator.validator[name] = function () {
    var args = Array.prototype.slice.call(arguments);
    return fn.apply(expressValidator.validator, args);
  };
};

expressValidator.validator.extend('isBetween', function(value, min, max) {
  return min <= value && value <= max;
});

expressValidator.validator.extend('isArray', function(value) {
  return _.isArray(value);
});

expressValidator.validator.extend('isEmpty', function(value) {
  return _.isEmpty(value);
});

// The improved version of `notEmpty`
expressValidator.validator.extend('hasValue', function(value) {
  return !_.isEmpty(value);
});


module.exports.express = {
  middleware: {
    expressValidator: expressValidator()
  }
};
