var when = require('when');
var pg = require('pg');
var wkt = require('terraformer-wkt-parser');

module.exports = {
  create: create,
  getReportJSON: getReportJSON,
  saveSymptoms: saveSymptoms,
  loadSymptoms: loadSymptoms
};

function create (values) {
  return when.promise(function(resolve, reject) {

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(error);
      }

      var preparedValues = [
        Boolean(values.isFine),
        Boolean(values.animalContact),
        new Date(values.startedAt),
        parseFloat(values.location.latitude),
        parseFloat(values.location.longitude),
        'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            values.location.latitude,
            values.location.longitude
          ]
        }),
        values.moreInfo,
        values.userId,
        values.createdAt || new Date(),
        values.updatedAt || new Date()
      ];

      client.query('\
        INSERT\
        INTO reports\
          ("isFine", "animalContact", "startedAt", "latitude", "longitude", "geom", "moreInfo", "userId", "createdAt", "updatedAt")\
        VALUES\
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * \
      ', preparedValues, function(err, result) {
        pgDone();

        if (err) {
          sails.log.error(err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(error);
        }

        var report = result.rows[0];

        saveSymptoms(report, values.symptoms)
          .then(function() {
            resolve(report);
          })
          .catch(function(err) {
            reject(err);
          });
      });
    });

  });
}

function saveSymptoms(report, symptoms) {
  return when.promise(function(resolve, reject) {
    // Get symptom id first
    when.map(symptoms, function(item) {
      var deferred = when.defer();

      Symptoms.findOrCreate({ name: item }, { name: item }).exec(function(err, result) {
        if (err) {
          sails.log.error(err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return deferred.reject(error);
        }

        deferred.resolve(result.id);
      });

      return deferred.promise;
    }).then(function(symptomsId) {

      pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
        if (err) {
          sails.log.error(err);
          var error = new Error("Could not connect to database");
          error.statusCode = 500;
          return reject(error);
        }

        var params = [];
        var values = [];
        var paramCount = 0;
        // Build params and value for pg query.
        _.each(symptomsId, function(symptomId, index) {
          params.push('($' + (++paramCount) + ',$' + (++paramCount) + ')');
          values.push(report.id);
          values.push(symptomId);
        });

        params = params.join(', ');

        client.query('INSERT INTO reportssymptoms ("reportId", "symptomId") VALUES ' + params, values, function(err, result) {
          pgDone();

          if (err) {
            sails.log.error(err);
            var error = new Error("Could not perform your request");
            error.statusCode = 500;
            return reject(error);
          }

          resolve();
        });
      });

    });
  });
}

function loadSymptoms(report) {
  return when.promise(function(resolve, reject) {

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(error);
      }

      client.query('\
        SELECT DISTINCT s.name as name\
        FROM reportssymptoms rs\
          LEFT JOIN symptoms s ON rs."symptomId" = s.id\
        WHERE rs."reportId" = $1\
      ', [ report.id ], function(err, result) {
        pgDone();

        if (err) {
          sails.log.error(err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(error);
        }

        var symptoms = _.map(result.rows, function(row) {
          return row.name;
        });

        resolve(symptoms);
      });
    });

  });
}

function getReportJSON(report, extra) {
  extra = extra || {};

  return _.assign({
    id: report.id,
    isFine: report.isFine,
    animalContact: report.animalContact,
    startedAt: report.startedAt,
    location: {
      longitude: report.longitude,
      latitude: report.latitude
    },
    moreInfo: report.moreInfo,
    createdAt: report.createdAt
  }, extra);
}
