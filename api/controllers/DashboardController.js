/*jshint multistr: true */
var pg = require('pg');
var when = require('when');
var moment = require('moment');
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

    var graphs = {
      BOE: [],
      SickSense: []
    };

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
        return ReportService.getILI(city, startDate, endDate)
          .then(function(result) {
            ILIThisWeek = result;
          })
          .then(function() {
            return ReportService.getILI(city, weekAgoStartDate, weekAgoEndDate);
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
      // Get ILI log for graph.
      .then(function() {
        return getILILogsAtDate('boe', currentDate)
          .then(function(result) {
            graphs.BOE = result;
          })
          .then(function() {
            return getILILogsAtDate('sicksense', currentDate);
          })
          .then(function(result) {
            graphs.SickSense = result;
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
          graphs: graphs,
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
        cityCriteria = ' AND r.city ILIKE $3 ';
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

function getILILogs(source, startDate, endDate, limit) {
  limit = limit || 6;

  return when.promise(function(resolve, reject) {

    var values = [ startDate.toJSON(), endDate.toJSON(), source, limit ];

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error('-- BOE stat error', err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      client.query('\
        SELECT * \
        FROM ililog\
        WHERE "date" BETWEEN $1 AND $2 \
              AND source = $3 \
        LIMIT $4 \
      ', values, function(err, result) {
        pgDone();

        if (err) {
          sails.log.error('-- BOE stat error (sql)', err);
          var error = new Error("Could not connect to database");
          error.statusCode = 500;
          return reject(err);
        }

        var rows = _.map(result.rows, function (item) {
          return {
            date: item.date,
            value: item.value
          };
        });

        resolve(rows);
      });
    });
  });
}

function getILILogsAtDate(source, date) {
  date = date || new Date();

  var dateObj;
  if (typeof date == 'string') {
    dateObj = new Date(Date.parse(date));
  }
  else {
    dateObj = new Date(date);
  }
  dateObj.clearTime();

  var firstDay = moment(dateObj).day('Sunday');

  return when
    .map(_.range(0, 6), function (i) {
      var a = moment(firstDay).add('week', i).toDate();
      var b = moment(a).add('day', 6).toDate();
      return getILILogs(source, a, b);
    })
    .then(function(rows) {
      return when.promise(function(resolve, reject) {
        var results = [];

        _.each(rows, function(row, i) {
          if (_.isEmpty(row)) {
            results.push({
              date: moment(firstDay).add('week', i).toDate(),
              value: 0
            });
          }
          else {
            results.push(row[0]);
          }
        });

        resolve(results);
      });
    });
}
