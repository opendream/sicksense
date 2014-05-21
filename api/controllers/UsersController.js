module.exports = {

  create: function(req, res) {
    req.checkBody('email', 'E-mail field is required').notEmpty();
    req.checkBody('email', 'E-mail field is not valid').isEmail();

    req.checkBody('password', 'Password field is required').notEmpty();
    req.checkBody('password', 'Password field must have length at least 8 characters').isLength(8);

    req.checkBody('tel', 'Telephone field is required').notEmpty();

    req.checkBody('gender', 'Gender field is required').notEmpty();
    req.checkBody('gender', 'Gender field is not valid').isIn(['male', 'female']);

    req.checkBody('birthYear', 'Birth Year field is required').notEmpty();
    req.checkBody('birthYear', 'Birth Year field is required').isInt();
    req.checkBody('birthYear', 'Birth Year field is not valid').isLength(4, 4);
    req.checkBody('birthYear', 'Birth Year field is not valid').isBefore(new Date());
    req.sanitize('birthYear').toInt();

    req.checkBody('address.subdistrict', 'Address:Subdistrict field is required').notEmpty();
    req.checkBody('address.district', 'Address:District field is required').notEmpty();
    req.checkBody('address.city', 'Address:City field is required').notEmpty();

    req.checkBody('location.latitude', 'Location:Latitude field is required').notEmpty();
    req.checkBody('location.latitude', 'Location:Latitude field is not valid').isFloat();
    req.sanitize('location.latitude').toFloat();
    req.checkBody('location.longitude', 'Location:Longitude field is required').notEmpty();
    req.checkBody('location.longitude', 'Location:Longitude field is not valid').isFloat();
    req.sanitize('location.longitude').toFloat();

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      return res.badRequest(_.first(errors).msg, paramErrors);
    }

    var data = req.body;
    var user = {
      email: data.email,
      password: data.password,
      tel: data.tel,
      gender: data.gender,
      birthYear: data.birthYear,
      subdistrict: data.address.subdistrict,
      district: data.address.district,
      city: data.address.city,
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      location: {
        "type": "Point",
        "coordinates": [
          data.location.longitude,
          data.location.latitude
        ]
      }
    };

    Users.create(user).exec(function(err) {
      if (err) {
        if (err.details.match(/duplicate key value violates unique constraint "users_email_key"/)) {
          res.conflict("This e-mail is already registered, please login or try another e-mail");
        }
        else {
          res.serverError("Can not create user");
        }

        return;
      }

      Users.findOneByEmail(data.email).exec(function(err, savedUser) {
        if (err) return res.serverError(err);
        res.ok(savedUser);
      });
    });
  }

};
