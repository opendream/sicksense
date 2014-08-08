/*jshint multistr: true */
var when = require('when');
var moment = require('moment');
require('date-utils');

module.exports = {

  now: function(req, res) {
    if (req.query.latitude) {
      req.check('latitude', 'Field `latitude` is not valid').isFloat();
      req.check('latitude', 'Field `latitude` field is out of valid range').isBetween(-90, 90);
      req.sanitize('latitude').toFloat();
    }
    if (req.query.longitude) {
      req.check('longitude', 'Field `longitude` field is not valid').isFloat();
      req.check('longitude', 'Field `longitude` field is out of valid range').isBetween(-180, 180);
      req.sanitize('longitude').toFloat();
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var date = moment(req.query.date || new Date());var city = req.query.city;
    var city = req.query.city;
    var latitude;
    var longitude;

    if (!city && !(req.query.latitude || req.query.longitude)) {
      city = "Bangkok";
    }
    else if (!city && req.query.latitude && req.query.longitude) {
      latitude = req.query.latitude;
      longitude = req.query.longitude;

      return LocationService.findCityByLatLng(latitude, longitude)
        .then(function (location) {
          if (!location) {
            city = 'Bangkok';
          }
          else {
            city = location.province_en;
            extraData = {
              location: {
                province_en: location.province_en,
                province_th: location.province_th
              }
            };
          }

          return dashboardProcess(req, res, city, date, extraData);
        });
    }

    return dashboardProcess(req, res, city, date);
  },

  index: function(req, res) {
    if (req.query.date) {
      req.check('date', 'Field `date` is invalid').isDate();
    }
    if (req.query.latitude) {
      req.check('latitude', 'Field `latitude` is not valid').isFloat();
      req.check('latitude', 'Field `latitude` field is out of valid range').isBetween(-90, 90);
      req.sanitize('latitude').toFloat();
    }
    if (req.query.longitude) {
      req.check('longitude', 'Field `longitude` field is not valid').isFloat();
      req.check('longitude', 'Field `longitude` field is out of valid range').isBetween(-180, 180);
      req.sanitize('longitude').toFloat();
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var date = moment(req.query.date || new Date()).add('week', -1);
    var city = req.query.city;
    var latitude;
    var longitude;

    if (!city && !(req.query.latitude || req.query.longitude)) {
      city = "Bangkok";
    }
    else if (!city && req.query.latitude && req.query.longitude) {
      latitude = req.query.latitude;
      longitude = req.query.longitude;

      return LocationService.findCityByLatLng(latitude, longitude)
        .then(function (location) {
          var extraData = {};

          if (!location) {
            city = 'Bangkok';
          }
          else {
            city = location.province_en;
            extraData = {
              location: {
                province_en: location.province_en,
                province_th: location.province_th
              }
            };
          }

          return dashboardProcess(req, res, city, date, extraData);
        });
    }

    return dashboardProcess(req, res, city, date);
  },
};

function dashboardProcess(req, res, city, date, extraData) {
  var client, pgDone;
  var data = {};
  var isError = false;

  // var startTime = Date.now();

  var startLastWeek = moment(date);

  var lastWeekNumber = moment(startLastWeek).week();
  var lastWeekYear= moment(startLastWeek).year();

  var lastTwoWeekNumber = moment(startLastWeek).add('week', -1).week();
  var lastTwoWeekYear = moment(startLastWeek).add('week', -1).year();


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
        thisWeek: UtilityService.toPercent(iliLastWeek, fineLastWeek + sickLastWeek),
        lastWeek: UtilityService.toPercent(iliLastTwoWeek, fineLastTwoWeek + sickLastTwoWeek)
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
            item.count = parseInt(item.count);

            var percent = UtilityService.toPercent(item.count, sum);

            data.topSymptoms.push({
              name: item.name,
              numberOfReports: item.count,
              percentOfReports: percent
            });
          });

          data.topSymptoms = UtilityService.refinePercent(data.topSymptoms, 'percentOfReports');

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
        var percentOfFinePeople = UtilityService.toPercent(data.finePeople, data.numberOfReporters);
        var percentOfSickPeople = 100.00 - percentOfFinePeople;

        res.ok(_.extend({
          reports: {
            count: data.reportsSummaryLastWeek.length,
            items: data.reportsSummaryLastWeek
          },
          ILI: data.ILI,
          numberOfReporters: data.numberOfReporters,
          numberOfReports: 0,
          numberOfFinePeople: data.finePeople,
          numberOfSickPeople: data.sickPeople,
          percentOfFinePeople: percentOfFinePeople,
          percentOfSickPeople: percentOfSickPeople,
          graphs: data.graphs,
          topSymptoms: data.topSymptoms
        }, extraData));
        // console.log('-: finished request.', Date.now() - startTime);
      }
    });
}

function getILILogs(client, source, startDate, endDate, limit) {
  limit = limit || 6;

  return when.promise(function(resolve, reject) {

    var values = [ moment(startDate).toJSON(), moment(endDate).toJSON(), source, limit ];

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
            value: UtilityService.toPercent(item.value, 100)
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
