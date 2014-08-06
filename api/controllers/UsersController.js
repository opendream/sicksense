
var hat = require('hat');
var wkt = require('terraformer-wkt-parser');
var passgen = require('password-hash-and-salt');
var when = require('when');

module.exports = {

  create: function(req, res) {
    req.checkBody('email', 'E-mail field is required').notEmpty();
    req.checkBody('email', 'E-mail field is not valid').isEmail();

    req.checkBody('password', 'Password field is required').notEmpty();
    req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);

    req.checkBody('gender', 'Gender field is required').notEmpty();
    req.checkBody('gender', 'Gender field is not valid').isIn(['male', 'female']);

    req.sanitize('birthYear').toInt();
    req.checkBody('birthYear', 'Birth Year field is required').notEmpty();
    req.checkBody('birthYear', 'Birth Year field is required').isInt();
    req.checkBody('birthYear', 'Birth Year field is not valid').isBetween(1900, (new Date()).getUTCFullYear());

    req.checkBody('address.subdistrict', 'Address:Subdistrict field is required').notEmpty();
    req.checkBody('address.district', 'Address:District field is required').notEmpty();
    req.checkBody('address.city', 'Address:City field is required').notEmpty();

    req.sanitize('location.latitude').toFloat();
    req.sanitize('location.longitude').toFloat();
    req.checkBody('location.latitude', 'Location:Latitude field is required').notEmpty();
    req.checkBody('location.latitude', 'Location:Latitude field is not valid').isFloat();
    req.checkBody('location.latitude', 'Location:Latitude field is not valid').isBetween(-90, 90);
    req.checkBody('location.longitude', 'Location:Longitude field is required').notEmpty();
    req.checkBody('location.longitude', 'Location:Longitude field is not valid').isFloat();
    req.checkBody('location.longitude', 'Location:Longitude field is not valid').isBetween(-180, 180);

    if (req.body.platform || req.query.platform) {
      req.sanitize('platform').trim();
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var data = req.body;
    passgen(data.password).hash(sails.config.session.secret, function(err, hashedPassword) {
      var values = [
        data.email,
        hashedPassword,
        data.tel,
        data.gender,
        data.birthYear,
        data.address.subdistrict,
        data.address.district,
        data.address.city,
        data.location.latitude,
        data.location.longitude,
        'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            data.location.latitude,
            data.location.longitude
          ]
        }),
        new Date(),
        new Date(),
        // platform at the time register.
        data.platform || req.query.platform || 'doctormeios'
      ];

      save(values);
    });

    function save(values) {
      pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, done) {
        if (err) return res.serverError("Could not connect to database");

        client.query('\
          INSERT \
          INTO "users" ( \
            "email", "password", "tel", "gender", "birthYear", "subdistrict", "district", \
            "city", "latitude", "longitude", "geom", "createdAt", "updatedAt", "platform" \
          ) \
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING * \
        ', values, function(err, result) {
          done();

          if (err) {
            if (err.detail.match(/Key \(email\).*already exists/)) {
              res.conflict("This e-mail is already registered, please login or try another e-mail");
            }
            else {
              res.serverError("Could not perform your request");
            }

            return;
          }

          var savedUser = result.rows[0];

          // Then generate accessToken.
          var accessToken;
          AccessTokenService.refresh(savedUser.id)
            .then(function(_accessToken) {
              accessToken = _accessToken;

              if (req.body.deviceToken === '') {
                return UserService.removeDefaultUserDevice(savedUser);
              }
              else if (req.body.deviceToken) {
                return UserService.setDevice(savedUser, { id: req.body.deviceToken });
              }
            })
            .then(function() {
              return UserService.getDefaultDevice(savedUser)
                .then(function (device) {
                  var extra = {
                    accessToken: accessToken.token
                  };
                  if (device) {
                    extra.deviceToken = device.id;
                  }
                  res.ok(UserService.getUserJSON(savedUser, extra));
                });
            })
            .catch(function(err) {
              sails.log.error(err);
              res.serverError(new Error("Registration is success but cannot automatically login. Please login manually."));
            });

        });
      });
    }
  },

  update: function(req, res) {
    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, accessToken) {
      if (err) {
        sails.log.error(err);
        return res.accessToken(new Error("Could not perform your request"));
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden(new Error("Can not save to other profile"));
      }

      if (req.body.gender) {
        req.checkBody('gender', 'Gender field is not valid').isIn(['male', 'female']);
      }

      if (req.body.birthYear) {
        req.sanitize('birthYear').toInt();
        req.checkBody('birthYear', 'Birth Year field is required').notEmpty();
        req.checkBody('birthYear', 'Birth Year field is required').isInt();
        req.checkBody('birthYear', 'Birth Year field is not valid').isBetween(1900, (new Date()).getUTCFullYear());
      }

      if (req.body.address) {
        req.checkBody('address.subdistrict', 'Address:Subdistrict field is required').notEmpty();
        req.checkBody('address.district', 'Address:District field is required').notEmpty();
        req.checkBody('address.city', 'Address:City field is required').notEmpty();
      }

      var errors = req.validationErrors();
      var paramErrors = req.validationErrors(true);
      if (errors) {
        return res.badRequest(_.first(errors).msg, paramErrors);
      }

      pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
        if (err) return res.serverError("Could not connect to database");

        var values = [
          req.body.gender || req.user.gender,
          req.body.birthYear || req.user.birthYear,
          (req.body.address && req.body.address.subdistrict) || req.user.subdistrict,
          (req.body.address && req.body.address.district) || req.user.district,
          (req.body.address && req.body.address.city) || req.user.city,
          new Date(),
          req.body.platform || req.query.platform || 'doctormeios',
          req.user.id
        ];

        client.query('\
          UPDATE "users" \
          SET \
            "gender" = $1, \
            "birthYear" = $2, \
            "subdistrict" = $3, \
            "district" = $4, \
            "city" = $5, \
            "updatedAt" = $6, \
            "platform" = $7 \
          WHERE id = $8 RETURNING * \
        ', values, function(err, result) {
          pgDone();

          if (err) {
            sails.log.error(err);
            return res.serverError("Could not perform your request");
          }

          var promise = when.resolve();

          var savedUser = result.rows[0];

          if (req.body.deviceToken === '') {
            promise = UserService.removeDefaultUserDevice(savedUser);
          }
          else if (req.body.deviceToken) {
            promise = UserService.clearDevices(req.user)
              .then(function () {
                return UserService.setDevice(savedUser, { id: req.body.deviceToken });
              });
          }

          promise.then(function () {
            UserService.getDefaultDevice(savedUser)
              .then(function (device) {
                var extra = {
                  accessToken: accessToken.token
                };
                if (device) {
                  extra.deviceToken = device.id;
                }
                res.ok(UserService.getUserJSON(savedUser, extra));
              });
          });
        });
      });
    });
  },

  userReports: function(req, res) {
    // Check own access token first.
    AccessToken.findOneByToken(req.query.accessToken).exec(function(err, accessToken) {
      if (err) {
        sails.log.error(err);
        return res.accessToken(new Error("Could not perform your request"));
      }

      if (!accessToken || accessToken.userId != req.params.id) {
        return res.forbidden(new Error("You can not get another user's reports"));
      }

      if (req.query.offset) {
        req.sanitize('offset', 'Field `offset` is not valid').toInt();
      }
      if (req.query.limit) {
        req.sanitize('limit', 'Field `limit` is not valid').toInt();
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

        var selectQuery, selectValues, countQuery, countValues;

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
    });
  }

};
