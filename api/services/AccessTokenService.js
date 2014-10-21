var when = require('when');
var hat = require('hat');
var rack = hat.rack(512, 36);
require('date-utils');

module.exports = {

  generateToken: function generateToken () {
    return rack();
  },

  refresh: function refresh (userId) {
    return when.promise(function(resolve, reject) {
      AccessToken.findOneByUserId(userId).exec(function(err, accessToken) {
        if (err) return reject(err);

        var isNew;

        if (isNew = !accessToken) {
          accessToken = accessToken || {
            userId: userId
          };
        }

        if (!accessToken.expired || accessToken.expired > new Date()) {
          // Renew
          accessToken.token = rack();
          accessToken.expired = (new Date()).addDays(sails.config.tokenLife);
        }

        if (isNew) {
          AccessToken.create(accessToken).exec(callback);
        }
        else {
          AccessToken.update({id: accessToken.id}, accessToken).exec(callback);
        }

        function callback(err, savedAccessToken) {
          if (err) return reject(err);
          if (savedAccessToken instanceof Array) {
            resolve(savedAccessToken[0]);
          }
          else {
            resolve(savedAccessToken);
          }
        };

      });
    });
  },

  delete: function (userId) {
    return when.promise(function (resolve, reject) {
      AccessToken.destroy({ userId: userId }).exec(function (err, result) {
        if (err) return reject(err);
        resolve(true);
      });
    });
  },

  clearFromAllSicksenseID: function (sicksenseId) {
    return when.promise(function (resolve, reject) {
      return DBService.select('sicksense_users', 'user_id', [
          { field: 'sicksense_id = $', value: sicksenseId }
        ])
        .then(function (result) {
          if (result.rows.length) return resolve();
          var users = result.rows;
          return when.map(users, function (user) {
            AccessTokenService.delete(user.id);
          });
        })
        .then(function () {
          resolve();
        })
        .catch(function (err) {
          reject(err);
        })
    })
  }

};
