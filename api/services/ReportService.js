var when = require('when');
var pg = require('pg');
var wkt = require('terraformer-wkt-parser');

module.exports = {
  create: create,
  getReportJSON: getReportJSON,
  saveSymptoms: saveSymptoms,
  loadSymptoms: loadSymptoms,
  loadLocationByAddress: loadLocationByAddress,
  loadUserAddress: loadUserAddress
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
        values.address.subdistrict,
        values.address.district,
        values.address.city,
        values.locationByAddress.latitude,
        values.locationByAddress.longitude,
        parseFloat(values.location.latitude),
        parseFloat(values.location.longitude),
        'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            values.location.longitude,
            values.location.latitude
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
          ("isFine", "animalContact", "startedAt", "subdistrict", "district", "city", \
           "addressLatitude", "addressLongitude", "latitude", "longitude", "geom", \
           "moreInfo", "userId", "createdAt", "updatedAt")\
        VALUES\
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING * \
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
    if (_.isEmpty(symptoms)) {
      return resolve([]);
    }
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

function loadUserAddress(report) {
  return when.promise(function(resolve, reject) {
    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(error);
      }

      UserService.getUserByID(client, report.userId)
        .then(function(user) {
          pgDone();
          
          if (!user) {
            var error = new Error("User not found");
            error.statusCode = 404;
            sails.log.error(error);
            return reject(error);
          }

          resolve({
            subdistrict: user.subdistrict,
            district: user.district,
            city: user.city
          });
        })
        .catch(function(err) {
          sails.log.error(err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(error);
        });
    });
  });
}

function loadLocationByAddress(address) {
  return when.promise(function(resolve, reject) {
    Locations.findOne({
      tambon_en: address.subdistrict,
      amphoe_en: address.district,
      province_en: address.city
    }).exec(function(err, location) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not perform your request");
        error.statusCode = 500;
        return reject(error);
      }

      resolve({
        latitude: location.latitude,
        longitude: location.longitude
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
    address: {
      subdistrict: report.subdistrict,
      district: report.district,
      city: report.city
    },
    locationByAddress: {
      longitude: report.addressLongitude,
      latitude: report.addressLatitude
    },
    location: {
      longitude: report.longitude,
      latitude: report.latitude
    },
    moreInfo: report.moreInfo,
    createdAt: report.createdAt
  }, extra);
}