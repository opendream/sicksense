var request = require('request');
var xml2js = require('xml2js');
var pg = require('pg');
var when = require('when');

var config = require('../config/local.js');
var FIRST_YEAR = 2010;

request('http://interfetpthailand.net/ili/', function (error, response, body) {

  var xmlString;

  if (error) {
    console.error(error);
  }

  if (response.statusCode === 200) {
    xmlString = body.match(/<xml>.*<\/xml>(<chart.*?>.*?<\/chart>)/);

    if (xmlString) {
      xml2js.parseString(removeBackslash(xmlString[1]), function (error, result) {
        if (error) {
          console.error(error);
          return;
        }

        if (!error && result) {
          pg.connect(config.connections.postgresql.connectionString, function (error, client, pgDone) {
            if (error) {
              console.error(error);
              return;
            }

            // Loop throught each dataSet (year).
            var index = 0;
            when
              .map(result.chart.dataSet, function (data) {
                var currentYear = FIRST_YEAR + (index++);

                return when.map(data.set, function (week) {
                  return when.promise(function(resolve, reject) {
                    var doc = {
                      source: 'boe',
                      year: currentYear,
                      week: parseFloat(week.$.x),
                      value: parseFloat(week.$.y)
                    };
                    var query = {
                      source: doc.boe,
                      year: doc.year,
                      week: doc.week
                    };

                    console.info('Saving year:', doc.year, 'week:', doc.week);

                    client.query(query, function (error, result) {
                      if (error) {
                        return reject(error);
                      }

                      var updateQuery = "UPDATE ililog SET value = $1, \"updatedAt\" = $2 WHERE year = $3 AND week = $4";
                      var updateValue = [doc.value, new Date(), doc.year, doc.week];

                      var insertQuery = "INSERT INTO ililog (source, year, week, value, \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6)";
                      var insertValue = [doc.source, doc.year, doc.week, doc.value, new Date(), new Date()];

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
                        if (error) {
                          console.error(error);
                          return reject(error);
                        }

                        resolve();
                      });
                    });
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
                pgDone();
              });
          });
        }
      });
    }
    else {
      console.log('No XML tag detect.');
    }
  }
});

function removeBackslash(text) {
  return text.replace(/\\\'/g, '\'');
}
