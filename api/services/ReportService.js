var when = require('when');
var wkt = require('terraformer-wkt-parser');
var moment = require('moment');
require('date-utils');

module.exports = {
  create: create,
  getReportJSON: getReportJSON,
  saveSymptoms: saveSymptoms,
  loadSymptoms: loadSymptoms,
  loadLocationByAddress: loadLocationByAddress,
  loadUserAddress: loadUserAddress,

  getILI: getILI
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

      var year = moment(values.startedAt).year();
      var week = moment(values.startedAt).week();
      var isILI;
      if (typeof values.isILI == 'undefined') {
        isILI = !_.isEmpty(_.intersection(sails.config.symptoms.ILISymptoms, values.symptoms));
      }

      var preparedValues = [
        Boolean(values.isFine),
        Boolean(values.animalContact),
        moment(values.startedAt).toJSON(),
        year,
        week,
        values.location_id,
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
        isILI,
        values.createdAt || new Date(),
        values.updatedAt || new Date(),
        values.platform || 'doctormeios'
      ];

      client.query('\
        INSERT\
        INTO reports\
          ("isFine", "animalContact", "startedAt", "year", "week", "location_id", "subdistrict", "district", "city", \
           "addressLatitude", "addressLongitude", "latitude", "longitude", "geom", \
           "moreInfo", "userId", "isILI", "createdAt", "updatedAt", "platform")\
        VALUES\
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING * \
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
    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(error);
      }

      client.query("\
        SELECT * FROM locations \
        WHERE (tambon_en = $1 OR tambon_th = $1) AND \
              (amphoe_en = $2 OR amphoe_th = $2)  AND \
              (province_en = $3 OR province_th = $3) \
      ", [ address.subdistrict, address.district, address.city ], function(err, result) {
        pgDone();

        if (err) {
          sails.log.error(err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(error);
        }

        resolve(result.rows[0]);
      });
    });
  });
}

function getReportJSON(report, extra) {
  extra = extra || {};

  return _.assign({
    id: report.id,
    isFine: report.isFine,
    isILI: report.isILI,
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
    createdAt: report.createdAt,
    platform: report.platform
  }, extra);
}

function getILI(city, startDate, endDate) {
  return when.promise(function(resolve, reject) {

    var ILISymptoms = sails.config.symptoms.ILISymptoms;
    var values = [ startDate.toJSON(), endDate.toJSON() ];
    var params = [];
    var lastIndex = 0;

    _.each(ILISymptoms, function(value, index) {
      values.push(value);
      lastIndex = index + 3;
      params.push('$' + lastIndex); // So it will be [ 3, 4, 5, ... ]
    });

    var cityCriteria = '';
    if (city) {
      cityCriteria = ' AND r.city = $' + (lastIndex + 1) + ' ';
      values.push(city);
    }

    var selectQuery = '\
      SELECT COUNT(DISTINCT r."userId") as ilicount \
      FROM reports r \
        INNER JOIN reportssymptoms rs ON r.id = rs."reportId" \
        INNER JOIN symptoms s ON rs."symptomId" = s.id \
      WHERE r."startedAt" BETWEEN $1 AND $2 \
        AND s.name IN (' + params.join(', ') + ') ' + cityCriteria + ' \
    ';

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      client.query(selectQuery, values, function(err, iliResult) {
        if (err) {
          sails.log.error('-- iliresult', err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(err);
        }

        var values = [ startDate.toJSON(), endDate.toJSON() ];
        if (city) {
          values.push(city);
          cityCriteria = ' AND r.city = $3 ';
        }

        // Count all reports for current week.
        client.query('\
          SELECT COUNT(DISTINCT r."userId") as total \
          FROM reports r \
          WHERE "startedAt" BETWEEN $1 AND $2 ' + cityCriteria + ' \
        ', values, function(err, totalResult) {
          pgDone();

          if (err) {
            sails.log.error('-- countili', err);
            var error = new Error("Could not perform your request");
            error.statusCode = 500;
            return reject(err);
          }

          return resolve(parseFloat(
            // Make it percent.
            (100.00 *
              // If NaN then it's zero.
              (iliResult.rows[0].ilicount / totalResult.rows[0].total || 0 )
            )
            // Only 2 digits after the decimal place.
            .toFixed(2)
          ));
        });
      });
    });
  });
}
