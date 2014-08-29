var pg = require('pg');
var when = require('when');
var moment = require('moment');
var _ = require('lodash');
require('date-utils');

var config = loadConfig();
var FIRST_YEAR = 2010;

// Loop throuth each year.
when
  .map(_.range(FIRST_YEAR, moment().year() + 1), function(year) {
    // Loop throuth each week.
    return when.map(_.range(1, 53), function (week) {
      // Calculate ILI for that week.
      var startDate = moment(year.toString()).weeks(week).day('Sunday');
      var endDate = moment(startDate).add('week', 1);

      return getILI(null, startDate, endDate)
        .then(function (ili) {
          // Save to ililog
          var doc = {
            source: 'sicksense',
            date: startDate.toDate().clearTime(),
            year: year,
            week: week,
            value: ili
          };

          return saveILILog(doc);
        });
    });
  })
  .then(function () {
    console.info('Import done.');
  })
  .catch(function (error) {
    console.error('Something error:', error);
  })
  .finally(function () {
    console.log('exit.');
    return;
  });

function saveILILog(doc) {
  return when.promise(function (resolve, reject) {
    pg.connect(config.connections.postgresql.connectionString, function (error, client, pgDone) {
      if (error) {
        pgDone();
        console.error(error);
        return;
      }

      console.info('Saving year:', doc.year, 'week:', doc.week);

      client.query(' \
        SELECT id FROM ililog WHERE source = $1 AND year = $2 AND week = $3 \
      ', [ doc.source, doc.year, doc.week ], function (error, result) {
        if (error) {
          pgDone();
          return reject(error);
        }

        var updateQuery = "UPDATE ililog SET date = $1, value = $2, \"updatedAt\" = $3 WHERE source = 'sicksense' AND year = $4 AND week = $5";
        var updateValue = [doc.date, doc.value, new Date(), doc.year, doc.week];

        var insertQuery = "INSERT INTO ililog (source, date, year, week, value, \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6, $7)";
        var insertValue = [doc.source, doc.date, doc.year, doc.week, doc.value, new Date(), new Date()];

        var query, value;
        if (result.rows.length > 0) {
          query = updateQuery;
          value = updateValue;
        }
        else {
          query = insertQuery;
          value = insertValue;
        }

        // Update
        client.query(query, value, function (error, result) {
          pgDone();

          if (error) {
            console.error(error);
            return reject(error);
          }

          resolve();
        });
      });

    });
  });
}

function getILI(city, startDate, endDate) {
  return when.promise(function(resolve, reject) {

    var ILISymptoms = config.symptoms.ILISymptoms;
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

    pg.connect(config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        pgDone();
        console.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(err);
      }

      client.query(selectQuery, values, function(err, iliResult) {
        if (err) {
          pgDone();
          console.log.error('-- iliresult', err);
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
            console.log.error('-- countili', err);
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

function loadConfig() {
  var files = [
    '../config/globals',
    '../config/connections.js',
    '../config/symptoms.js',
    '../config/local.js'
  ];

  var config = {};
  _.each(files, function (file) {
    _.extend(config, require(file));
  });

  return config;
}
