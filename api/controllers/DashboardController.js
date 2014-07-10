/*jshint multistr: true */
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

    var city = req.query.city || "Bangkok";

    var startLastWeek = moment(new Date(req.query.date || new Date())).add('week', -1);

    var lastWeekNumber = moment(startLastWeek).week();
    var lastWeekYear= moment(startLastWeek).year();

    var lastTwoWeekNumber = moment(startLastWeek).add('week', -1).week();
    var lastTwoWeekYear = moment(startLastWeek).add('week', -1).year();

    (function () {
      var client, pgDone;
      var data = {};
      var isError = false;

      // var startTime = Date.now();

      return when
        .promise(function (resolve, reject) {
          pg.connect(sails.config.connections.postgresql.connectionString, function (err, _client, _pgDone) {
            if (err) return reject(err);

            client = _client;
            pgDone = _pgDone;
            resolve();
          });
        })
        .then(function () {
          // console.log('-: connect pg', Date.now() - startTime);
          // Get report summary, last week and last two week.
          return when.promise(function (resolve, reject) {
            var values = [ lastWeekYear, lastWeekNumber, lastTwoWeekYear, lastTwoWeekNumber ];

            var cityCriteria = '';
            if (city && city != 'all') {
              cityCriteria = ' AND ( lower(l.province_en) = lower($5) OR l.province_th = $5 ) ';
              values.push(city);
            }

            var query = "\
              SELECT \
                location_id, year, week, fine, sick, ili_count, tambon_en, amphoe_en, province_en, latitude, longitude \
              FROM reports_summary_by_week s \
                INNER JOIN locations l ON s.location_id = l.id \
              WHERE \
                ( \
                  ( year = $1 AND week = $2 ) OR \
                  ( year = $3 AND week = $4 ) \
                ) \
                " + cityCriteria + " \
              ORDER BY \
                year DESC, week DESC \
            ";

            client.query(query, values, function (err, result) {
              if (err) return reject(err);
              data.reportsSummary = result.rows;
              resolve();
            });
          });
        })
        .then(function () {
          //console.log('-: finished query reports_summary_by_week', Date.now() - startTime);
          // Prepare reports.
          data.reportsSummaryLastWeek = [];
          data.reportsSummaryLastTwoWeek = [];
          
          var iliLastWeek = 0;
          var fineLastWeek = 0;
          var sickLastWeek = 0;
          var iliLastTwoWeek = 0;
          var fineLastTwoWeek = 0;
          var sickLastTwoWeek = 0;

          _.each(data.reportsSummary, function (item) {
            if (item.year == lastWeekYear && item.week == lastWeekNumber) {
              data.reportsSummaryLastWeek.push({
                subdistrict: item.tambon_en,
                district: item.amphoe_en,
                city: item.province_en,
                latitude: item.latitude,
                longitude: item.longitude,
                fineCount: item.fine,
                sickCount: item.sick,
                total: item.fine + item.sick
              });
              iliLastWeek += item.ili_count;
              fineLastWeek += item.fine;
              sickLastWeek += item.sick;
            }
            else {
              data.reportsSummaryLastTwoWeek.push({
                subdistrict: item.tambon_en,
                district: item.amphoe_en,
                city: item.province_en,
                latitude: item.latitude,
                longitude: item.longitude,
                fineCount: item.fine,
                sickCount: item.sick,
                total: item.fine + item.sick
              });
              iliLastTwoWeek += item.ili_count;
              fineLastTwoWeek += item.fine;
              sickLastTwoWeek += item.sick;
            }
          });

          data.finePeople = fineLastWeek;
          data.sickPeople = sickLastWeek;
          data.numberOfReporters = fineLastWeek + sickLastWeek;

          // Calculate ILI
          data.ILI = {
            thisWeek: ((iliLastWeek / (fineLastWeek + sickLastWeek)) * 100),
            lastWeek: ((iliLastTwoWeek / (fineLastTwoWeek + sickLastTwoWeek)) * 100)
          };
          data.ILI.delta = (data.ILI.thisWeek - data.ILI.lastWeek);
        })
        // Get ILI log for graph.
        .then(function() {
          var a = moment(startLastWeek).startOf('week');
          var b = moment(a).add('week', 5).endOf('week');

          data.graphs = {};
          return getILILogs(client, 'boe', a, b)
            .then(function(result) {
              data.graphs.BOE = result;
            })
            .then(function() {
              return getILILogs(client, 'sicksense', a, b);
            })
            .then(function(result) {
              data.graphs.SickSense = result;
            });
        })
        .then(function() {
          //console.log('-: finished get ILILogs', Date.now() - startTime);
          return when.promise(function(resolve, reject) {
            var values = [ lastWeekYear, lastWeekNumber ];

            var cityCriteria = '';
            if (city && city != 'all') {
              cityCriteria = ' AND ( lower(l.province_en) = lower($3) OR l.province_th = $3 ) ';
              values.push(city);
            }

            var query = " \
              SELECT s.name, COUNT(s.name) as count \
              FROM symptoms_summary_by_week ss \
                INNER JOIN locations l ON ss.location_id = l.id \
                INNER JOIN symptoms s ON ss.symptom_id = s.id \
              WHERE \
                  ( year = $1 AND week = $2 ) " + cityCriteria + " \
              GROUP BY s.name \
              ORDER BY count DESC \
            ";

            data.topSymptoms = [];
            client.query(query, values, function(err, result) {
              if (err) return reject(err);

              var sum = _.reduce(_.pluck(result.rows, 'count'), function(x, y) {
                return parseInt(x) + parseInt(y);
              });

              _.each(result.rows, function(item) {
                data.topSymptoms.push({
                  name: item.name,
                  numberOfReports: parseInt(item.count),
                  percentOfReports: (parseInt(item.count) / sum) * 100
                });
              });

              resolve();
              
            });
          });
        })
        .catch(function (err) {
          sails.log.error(err);
          if (err) isError = err;
        })
        .finally(function () {
          // console.log('-: finished topSymptoms', Date.now() - startTime);
          pgDone();
          
          if (isError) {
            res.serverError("Could not perform your request");
          }
          else {
            res.ok({
              reports: {
                count: data.reportsSummaryLastWeek.length,
                items: data.reportsSummaryLastWeek
              },
              ILI: data.ILI,
              numberOfReporters: data.numberOfReporters,
              numberOfReports: 0,
              numberOfFinePeople: data.finePeople,
              numberOfSickPeople: data.sickPeople,
              percentOfFinePeople: ((data.finePeople / data.numberOfReporters) * 100),
              percentOfSickPeople: ((data.sickPeople / data.numberOfReporters) * 100),
              graphs: data.graphs,
              topSymptoms: data.topSymptoms
            });
            // console.log('-: finished request.', Date.now() - startTime);
          }
        });
    })();
  },

  oldIndex: function(req, res) {
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
        cityCriteria = ' AND r.city ILIKE $3 ';
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
        cityCriteria = ' AND r.city ILIKE $3 ';
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
        cityCriteria = ' AND r.city ILIKE $3 ';
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

function getILILogs(client, source, startDate, endDate, limit) {
  limit = limit || 6;

  return when.promise(function(resolve, reject) {

    var values = [ new Date(startDate).toJSON(), new Date(endDate).toJSON(), source, limit ];

    client.query('\
      SELECT * \
      FROM ililog\
      WHERE "date" BETWEEN $1 AND $2 \
            AND source = $3 \
      ORDER BY "date" \
      LIMIT $4 \
    ', values, function(err, result) {

      if (err) {
        sails.log.error('-- ILILOGS stat error (sql)', err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      var numberOfWeek = (endDate - startDate) / (7 * 86400000);
      // Find different week between first existing data and actual start date.
      var firstDate = (result.rows[0] && result.rows[0].date) || startDate;
      var diff = (firstDate - startDate) / (7 * 86400000);

      var results = _.map(_.range(0, numberOfWeek), function(i) {
        var item;

        if (item = result.rows[i - diff]) {
          return {
            date: item.date,
            value: item.value
          };
        }
        else {
          return {
            date: moment(startDate).add('week', i),
            value: 0
          };
        }
      });

      resolve(results);
    });
  });
}
