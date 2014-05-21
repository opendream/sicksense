/**
 * Load Sails server before test.
 */

// Make 'sails' global variable.
var sails = require('sails');

var rc = require('rc');

before(function(done) {
  sails.lift(rc('sails'), function(err, sails) {
    if (err) return sails.log.error(err);
    done();
  });
});

after(function(done) {
  sails.lower(done);
});
