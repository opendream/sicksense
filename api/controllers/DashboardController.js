/*jshint multistr: true */
var pg = require('pg');
var when = require('when');
require('date-utils');

module.exports = {
  index: function(req, res) {
    if (req.query.date) {
      req.check('date', 'Field `date` is invalid').isDate();
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var reports;
    var ILIThisWeek, ILILastWeek, ILIDelta;
    var numberOfReporters, numberOfReports, numberOfFinePeople, numberOfSickPeople, percentOfFinePeople, percentOfSickPeople;
    var topSymptoms;

    // Query parameters.
    var city = req.query.city;
    var currentDate = (new Date(req.query.date || new Date())).addDays(-7);
    var weekAgoDate = (new Date(currentDate)).addDays(-7);

    // Get the first week day.
    var startDate = (new Date(currentDate)).addDays(-1 * currentDate.getDay()).clearTime();
    // .. and endDate = startDate + 7 days
    var endDate = (new Date(startDate)).addDays(7);

    var weekAgoStartDate = (new Date(startDate)).addDays(-7);
    var weekAgoEndDate = (new Date(endDate)).addDays(-7);

    getReportSummary(city, startDate, endDate)
      // Get reports summary
      .then(function(result) {
        reports = result;
      })
      // Get ILI summary
      .then(function() {
        return getILI(city, startDate, endDate)
          .then(function(result) {
            ILIThisWeek = result;
          })
          .then(function() {
            return getILI(city, weekAgoStartDate, weekAgoEndDate);
          })
          .then(function(result) {
            ILILastWeek = result;
            ILIDelta = ILIThisWeek - ILILastWeek;
          });
      })
      // Get report stat
      .then(function() {
        return getNumberOfReportersAndReports(city, startDate, endDate)
          .then(function(result) {
            numberOfReporters = result.numberOfReporters;
            numberOfReports = result.numberOfReports;
          });
      })
      // Get top(popular) symptoms
      .then(function() {
        return getTopSymptoms(city, startDate, endDate)
          .then(function(result) {
            topSymptoms = result.items;
          });
      })
      // Get fine and sick numbers
      .then(function() {
        return getFineAndSickNumbers(city, startDate, endDate)
          .then(function(result) {
            numberOfFinePeople = result.fineCount;
            numberOfSickPeople = result.sickCount;
            percentOfFinePeople = result.finePercent;
            percentOfSickPeople = result.sickPercent;
          });
      })
      // Send error
      .catch(function(err) {
        if (err.statusCode == 404) {
          res.notFound(err);
        }
        else {
          res.serverError(err);
        }
      })
      // Clean up.
      .finally(function() {
        res.ok({
          reports: {
            count: reports.length,
            items: reports
          },
          ILI: {
            thisWeek: ILIThisWeek,
            lastWeek: ILILastWeek,
            delta: ILIDelta
          },
          numberOfReporters: numberOfReporters,
          numberOfReports: numberOfReports,
          numberOfFinePeople: numberOfFinePeople,
          numberOfSickPeople: numberOfSickPeople,
          percentOfFinePeople: percentOfFinePeople,
          percentOfSickPeople: percentOfSickPeople,
          graphs: {
            BOE: [ 0 ],
            Sicksense: [ 0 ]
          },
          topSymptoms: topSymptoms
        });
      });
  }
};


function getReportSummary(city, startDate, endDate) {
  return when.promise(function(resolve, reject) {

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      var values = [ startDate.toJSON(), endDate.toJSON() ];

      var cityCriteria = '';
      if (city) {
        cityCriteria = ' AND r.city = $3 ';
        values.push(city);
      }

      var selectQuery = ' \
        SELECT \
          r2.subdistrict, \
          r2.district, \
          r2.city, \
          MAX(r2."addressLatitude") as latitude, \
          MAX(r2."addressLongitude") as longitude, \
          COUNT(CASE WHEN r2."isFine" THEN 1 ELSE NULL END) as finecount, \
          COUNT(CASE WHEN r2."isFine" THEN NULL ELSE 1 END) as sickcount, \
          COUNT(*) as total \
        FROM ( \
          SELECT \
            r."userId", \
            MAX(r.subdistrict) as subdistrict, \
            MAX(r.district) as district, \
            MAX(r.city) as city, \
            MAX(r."addressLatitude") as "addressLatitude", \
            MAX(r."addressLongitude") as "addressLongitude", \
            BOOL_AND(r."isFine") as "isFine" \
          FROM reports r \
          WHERE r."startedAt" BETWEEN $1 AND $2 ' + cityCriteria + ' \
          GROUP BY r."userId" \
        ) as r2 \
        GROUP BY r2.city, r2.district, r2.subdistrict \
      ';

      client.query(selectQuery, values, function(err, result) {
        pgDone();

        if (err) {
          sails.log.error(err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(err);
        }

        return resolve(_.map(result.rows, function(row) {
          return {
            subdistrict: row.subdistrict,
            district: row.district,
            city: row.city,
            latitude: parseFloat(row.latitude),
            longitude: parseFloat(row.longitude),
            fineCount: parseInt(row.finecount),
            sickCount: parseInt(row.sickcount),
            total: parseInt(row.total)
          };
        }));
      });
    });
  });
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

function getNumberOfReportersAndReports(city, startDate, endDate) {
  return when.promise(function(resolve, reject) {


    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error('-- report numbers', err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      var values = [ startDate.toJSON(), endDate.toJSON() ];

      var cityCriteria = '';
      if (city) {
        cityCriteria = ' AND r.city = $3 ';
        values.push(city);
      }

      client.query(' \
        SELECT COUNT(*) as totalreports, COUNT(DISTINCT "userId") as totalreporters \
        FROM reports r \
        WHERE "startedAt" BETWEEN $1 AND $2 ' + cityCriteria + ' \
      ', values, function(err, result) {
        pgDone();

        if (err) {
          sails.log.error('-- count report numbers', err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(err);
        }

        return resolve({
          numberOfReporters: parseInt(result.rows[0].totalreporters),
          numberOfReports: parseInt(result.rows[0].totalreports)
        });
      });
    });
  });
}

function getTopSymptoms(city, startDate, endDate) {
  return when.promise(function(resolve, reject) {

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error('-- get top symptoms', err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      var values = [ startDate.toJSON(), endDate.toJSON() ];

      var cityCriteria = '';
      if (city) {
        cityCriteria = ' AND r.city = $3 ';
        values.push(city);
      }

      client.query('\
        SELECT s.name as name, COUNT(DISTINCT r."userId") as count \
        FROM reports r \
          INNER JOIN reportssymptoms rs ON r.id = rs."reportId" \
          INNER JOIN symptoms s ON rs."symptomId" = s.id \
        WHERE r."startedAt" BETWEEN $1 AND $2 ' + cityCriteria + ' \
        GROUP BY s.name \
        ORDER BY count DESC \
      ', values, function(err, selectResult) {

        if (err) {
          sails.log.error('-- get top symptoms', err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(err);
        }

        // Count all reports for current week.
        client.query('\
          SELECT COUNT(DISTINCT r."userId") as total \
          FROM reports r \
          WHERE r."startedAt" BETWEEN $1 AND $2 ' + cityCriteria + ' \
            AND r."isFine" IS FALSE \
        ', values, function(err, totalResult) {
          pgDone();

          if (err) {
            sails.log.error('-- get count symptoms', err);
            var error = new Error("Could not perform your request");
            error.statusCode = 500;
            return reject(err);
          }

          var total = parseInt(totalResult.rows[0].total);
          var topList = _.map(selectResult.rows, function(row) {
            return {
              name: row.name,
              numberOfReports: parseInt(row.count),
              percentOfReports: parseFloat(100 * (row.count / total).toFixed(2))
            };
          });

          return resolve({
            count: total,
            items: topList
          });

        });
      });
    });
  });
}

function getFineAndSickNumbers(city, startDate, endDate) {
  return when.promise(function(resolve, reject) {

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error('-- fine and sick numbers', err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      var values = [ startDate.toJSON(), endDate.toJSON() ];

      var cityCriteria = '';
      if (city) {
        cityCriteria = ' AND r.city = $3 ';
        values.push(city);
      }

      client.query(' \
        SELECT \
          COUNT(uid) as total, \
          COUNT(CASE WHEN fine::boolean THEN 1 ELSE NULL END) as finecount, \
          COUNT(CASE WHEN fine::boolean THEN NULL ELSE 1 END) as sickcount \
        FROM ( \
          SELECT r."userId" as uid, MIN("isFine"::int) as fine \
          FROM reports r \
          WHERE "startedAt" BETWEEN $1 AND $2 ' + cityCriteria + ' \
          GROUP BY r."userId" \
        ) as sub \
      ', values, function(err, result) {
        pgDone();

        if (err) {
          sails.log.error('-- count fine and sick numbers', err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(err);
        }

        var total = parseInt(result.rows[0].total);
        var fineCount = parseInt(result.rows[0].finecount);
        var sickCount =  parseInt(result.rows[0].sickcount);

        resolve({
          total: total,
          fineCount: fineCount,
          sickCount: sickCount,
          finePercent: parseFloat((100 * ( (fineCount / total) || 0)).toFixed(2)),
          sickPercent: parseFloat((100 * ( (sickCount / total) || 0)).toFixed(2))
        });
      });
    });
  });
}