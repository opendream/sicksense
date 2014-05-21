var pg = require('pg');

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
    var values = [
      data.email,
      data.password,
      data.tel,
      data.gender,
      data.birthYear,
      data.address.subdistrict,
      data.address.district,
      data.address.city,
      data.location.latitude,
      data.location.longitude,
      new Date(),
      new Date()
    ];

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, done) {
      if (err) return res.serverError("Could not connect to database");

      client.query('\
        INSERT \
        INTO "users" ( \
          "email", "password", "tel", "gender", "birthYear", "subdistrict", "district", \
          "city", "latitude", "longitude", "createdAt", "updatedAt" \
        ) \
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING * \
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

        res.ok({
          id: savedUser.id,
          email: savedUser.email,
          tel: savedUser.tel,
          gender: savedUser.gender,
          birthYear: savedUser.birthYear,
          address: {
            subdistrict: savedUser.subdistrict,
            district: savedUser.district,
            city: savedUser.city
          },
          location: {
            longitude: savedUser.longitude,
            latitude: savedUser.latitude
          }
        });

      });
    });

    return;
  }

};
