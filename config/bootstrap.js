/**
 * Bootstrap
 * (sails.config.bootstrap)
 *
 * An asynchronous bootstrap function that runs before your Sails app gets lifted.
 * This gives you an opportunity to set up your data model, run jobs, or perform some special logic.
 *
 * For more information on bootstrapping your app, check out:
 * http://links.sailsjs.org/docs/config/bootstrap
 */
var when = require('when');
var _ = require('lodash');

module.exports.bootstrap = function(cb) {

  // It's very important to trigger this callack method when you are finished
  // with the bootstrap!  (otherwise your server will never lift, since it's waiting on the bootstrap)

  // ADD and UPDATE symptoms.
  var symptoms = sails.config.symptoms.items;

  when
    .map(symptoms, function (item) {
      return when.promise(function (resolve, reject) {

        Symptoms.findOrCreate({
          name: item.slug
        }, {
          name: item.slug
        }, function (err, result) {
          if (err) return reject(err);

          result.isILI = _.contains(sails.config.symptoms.ILISymptoms, item.slug);
          result.predefined = true;
          result.save(function (err) {
            if (err) return reject(err);
            resolve();
          });

        });

      });
    })
    .then(function () {
      cb();
    })
    .catch(function (err) {
      sails.log.error(err);
      cb(err);
    });
};
