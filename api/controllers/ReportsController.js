var pg = require('pg');
var when = require('when');

/**
 * ReportsController
 *
 * @description :: Server-side logic for managing reports
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {
  index: function(req, res) {
    if (req.query.offset) {
      req.sanitize('offset', 'Field `offset` is not valid').toInt();
    }
    if (req.query.limit) {
      req.sanitize('limit', 'Field `limit` is not valid').toInt();
    }

    if (req.query.sw || req.query.ne) {
      req.check('sw', 'Field `sw` is required if field `ne` is provided').notEmpty();
      req.check('ne', 'Field `ne` is required if field `sw` is provided').notEmpty();
    }

    if (req.query.sw) {
      req.check('sw', 'Field `sw` is not valid').isLatitudeLongitudePairs();
    }

    if (req.query.ne) {
      req.check('ne', 'Field `ne` is not valid').isLatitudeLongitudePairs();
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var query = _.extend({
      offset: 0,
      limit: 10
    }, req.query);

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        return res.serverError(new Error("Could not connect to database"));
      }

      var sw, ne, selectQuery, selectValues, countQuery, countValues;

      if (req.query.sw && req.query.ne) {
        sw = {
          latitude: parseFloat(req.query.sw.split(',')[0]),
          longitude: parseFloat(req.query.sw.split(',')[1])
        };

        ne = {
          latitude: parseFloat(req.query.ne.split(',')[0]),
          longitude: parseFloat(req.query.ne.split(',')[1])
        };

        selectQuery = "\
          SELECT * \
          FROM reports r \
          WHERE ST_Within(r.geom, ST_GeomFromText('POLYGON((' || $1 || ' ' || $2 || ',' || $3 || ' ' || $4 || ',' || $5 || ' ' || $6 || ',' || $7 || ' ' || $8 || ',' || $1 || ' ' || $2 || '))', 4326)) \
          ORDER BY r.\"createdAt\" DESC \
          LIMIT $9 OFFSET $10\
        ";
        selectValues = [
          sw.longitude, sw.latitude,
          ne.longitude, sw.latitude,
          ne.longitude, ne.latitude,
          sw.longitude, ne.latitude,
          query.limit, query.offset
        ];

        countQuery = "\
          SELECT COUNT(*) as total \
          FROM reports r \
          WHERE ST_Within(r.geom, ST_GeomFromText('POLYGON((' || $1 || ' ' || $2 || ',' || $3 || ' ' || $4 || ',' || $5 || ' ' || $6 || ',' || $7 || ' ' || $8 || ',' || $1 || ' ' || $2 || '))', 4326)) \
        ";
        countValues = [
          sw.longitude, sw.latitude,
          ne.longitude, sw.latitude,
          ne.longitude, ne.latitude,
          sw.longitude, ne.latitude
        ];
      }
      else {
        selectQuery = '\
          SELECT * \
          FROM reports r \
          ORDER BY r."createdAt" DESC \
          LIMIT $1 OFFSET $2\
        ';
        selectValues = [ query.limit, query.offset ];

        countQuery = '\
          SELECT COUNT(r.id) as total \
          FROM reports r \
        ';
        countValues = [];
      }

      client.query(selectQuery, selectValues, function(err, result) {
        if (err) {
          sails.log.error(err);
          return res.serverError(new Error("Could not perform your request"));
        }

        client.query(countQuery, countValues, function(err, countResult) {
          pgDone();

          if (err) {
            sails.log.error(err);
            return res.serverError(new Error("Could not perform your request"));
          }

          when.map(result.rows, function(row) {
            return when.promise(function(resolve, reject) {
              ReportService.loadSymptoms(row)
                .then(function(symptoms) {
                  row.symptoms = symptoms;
                  resolve();
                })
                .catch(reject);
            });
          }).then(function() {
            res.ok({
              reports: {
                count: parseInt(countResult.rows[0].total),
                items: _.map(result.rows, function(row) {
                  return ReportService.getReportJSON(row, { symptoms: row.symptoms });
                })
              }
            });
          });
        });
      });
    });
  },

	create: function(req, res) {
    req.checkBody('isFine', 'Field `isFine` is required').notEmpty();

    if (!req.body.isFine) {
      req.checkBody('symptoms', 'Field `symptoms` is required').notEmpty();
      req.checkBody('symptoms', 'Field `symptoms` is not valid').isArray();
    }

    req.checkBody('animalContact', 'Field `animalContact` is required').notEmpty();

    req.checkBody('startedAt', 'Field `startedAt` is required').notEmpty();
    req.checkBody('startedAt', 'Field `startedAt` is not valid').isDate();

    req.checkBody('location', 'Field `location` is required').hasValue();
    if (req.body.location) {
      req.checkBody('location.latitude', 'Field `location.latitude` is required').notEmpty();
      req.checkBody('location.latitude', 'Location:Latitude field is not valid').isFloat();
      req.checkBody('location.latitude', 'Location:Latitude field is not valid').isBetween(-90, 90);
      req.checkBody('location.longitude', 'Field `location.longitude` is required').notEmpty();
      req.checkBody('location.longitude', 'Location:Longitude field is not valid').isFloat();
      req.checkBody('location.longitude', 'Location:Longitude field is not valid').isBetween(-180, 180);
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var values = req.body;
    values.userId = req.user.id;

    var report;
    ReportService.create(req.body)
      .then(function(_report) {
        report = _report;
        return ReportService.loadSymptoms(_report);
      })
      .then(function(symptoms) {
        return res.ok(ReportService.getReportJSON(report, { symptoms: symptoms }));
      })
      .catch(function(err) {
        res.serverError(err);
      });
  }
};
