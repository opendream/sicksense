var pg = require('pg');
var hat = require('hat');
var wkt = require('terraformer-wkt-parser');
var passgen = require('password-hash-and-salt');

module.exports = {

  create: function(req, res) {
    req.checkBody('email', 'E-mail field is required').notEmpty();
    req.checkBody('email', 'E-mail field is not valid').isEmail();

    req.checkBody('password', 'Password field is required').notEmpty();
    req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);

    req.checkBody('tel', 'Telephone field is required').notEmpty();

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
        new Date()
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
            "city", "latitude", "longitude", "geom", "createdAt", "updatedAt" \
          ) \
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING * \
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
          AccessTokenService.refresh(savedUser.id)
            .then(function(accessToken) {
              res.ok(UserService.getUserJSON(savedUser, { accessToken: accessToken.token }));
            })
            .catch(function(err) {
              sails.log.error(err);
              res.serverError(new Error("Registration is success but cannot automatically login. Please login manually."));
            });

        });
      });
    }
  }

};
