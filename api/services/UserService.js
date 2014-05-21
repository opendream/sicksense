var when = require('when');
var passgen = require('password-hash-and-salt');

module.exports = {
  getUserByEmailPassword: getUserByEmailPassword,
  getAccessToken: getAccessToken,
  getUserByID: getUserByID,
  getUserJSON: getUserJSON
};

function getUserByEmailPassword(client, email, password) {
  return when.promise(function(resolve, reject) {
    passgen(password).hash(sails.config.session.secret, function(err, hashedPassword) {
      client.query(
        'SELECT * FROM users WHERE email=$1 AND password=$2',
        [ email, hashedPassword ],
        function(err, result) {
          if (err) {
            err.statusCode = 500;
            reject(err);
            return;
          }

          if (result.rows.length === 0) {
            var error = new Error("E-mail and Password pair is not valid");
            error.statusCode = 403;
            reject(error);
            return;
          }

          resolve(result.rows[0]);
        }
      );
    });
  });
}

function getUserByID(client, id) {
  return when.promise(function(resolve, reject) {
    client.query('SELECT * FROM users WHERE id=$1::int', [ id ], function(err, result) {
      if (err) return reject(err);
      if (result.rows.length === 0) return reject(new Error("User not found"));

      resolve(result.rows[0]);
    });
  });
}

function getAccessToken(client, userId, refresh) {
  return when.promise(function(resolve, reject) {
    // ORM first :P (ignore `client`).
    AccessToken.findOne({
      userId: userId
    }).exec(function(err, accessToken) {
      if (err) return reject(err);
      if (!accessToken) {
        if (refresh) {
          AccessTokenService.refresh(userId)
            .then(function(accessToken) {
              resolve(accessToken);
            })
            .catch(function(err) {
              reject(err);
            });
        }
        else {
          var error = new Error("AccessToken not found");
          error.statusCode = 404;
          return reject(error);
        }
      }
      else {
        resolve(accessToken);
      }
    });
  });
}

function getUserJSON(user, extra) {
  extra = extra || {};

  return _.assign({
    id: user.id,
    email: user.email,
    tel: user.tel,
    gender: user.gender,
    birthYear: user.birthYear,
    address: {
      subdistrict: user.subdistrict,
      district: user.district,
      city: user.city
    },
    location: {
      longitude: user.longitude,
      latitude: user.latitude
    }
  }, extra);
}
