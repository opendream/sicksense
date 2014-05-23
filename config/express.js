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

expressValidator.validator.extend('isLatitudeLongitudePairs', function(value) {
  var value = value.split(',');
  var latitude = value[0];
  var longitude = value[1];

  return  (-90.0 <= latitude && latitude <= 90.0) && (-180.0 <= longitude && longitude <= 180.0);
});


module.exports.express = {
  middleware: {
    expressValidator: expressValidator()
  }
};
