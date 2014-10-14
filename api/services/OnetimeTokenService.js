var hat = require('hat');
var when = require('when');
var assert = require('assert');

module.exports = {

  create: function create(type, userId, lifetime) {
    var token,
        expired;

    assert.notEqual(type, undefined, 'type should be defined');
    assert.notEqual(userId, undefined, 'userId should be defined');

    lifetime = lifetime || sails.config.onetimetoken.lifetime;
    token = hat.rack(256, 36)();
    expired = ( new Date( (new Date()).getTime() + (lifetime * 1000) ) );

    return when.promise(function (resolve, reject) {

      return validate()
        .then(function () {

          return DBService
            .insert('onetimetoken', [
              { field: 'user_id', value: userId },
              { field: 'token', value: token },
              { field: 'expired', value: expired },
              { field: 'type', value: type }
            ])
            .then(function (result) {
              resolve(result.rows[0]);
            })
            .catch(function (err) {
              reject(err);
            });

        })
        .catch(function (err) {
          reject(err);
        });

    });


    function validate() {

      return when.promise(function (resolve, reject) {

        DBService
        .select('users', 'id', [
          { field: 'id = $', value: userId }
        ])
        .then(function (result) {
          assert.notEqual(result.rows.length, 0);
          resolve();
        })
        .catch(function (err) {
          reject(err);
        });

      });

    }

  },

  getByEmail: function(email, type) {
    return when.promise(function (resolve, reject) {
      return validate()
        .then(function(user) {
          return DBService.select('onetimetoken', '*', [
              { field: 'user_id = $', value: user.id },
              { field: 'type = $', value: type }
            ])
            .then(function(result) {
              resolve(result.rows[0]);
            })
            .catch(function(err) {
              reject(err);
            });
        })
        .catch(function(err) {
          reject(err);
        });
    });

    function validate() {

      return when.promise(function (resolve, reject) {
        DBService.select('users', 'id', [
          { field: 'email = $', value: email }
        ])
        .then(function (result) {
          assert.notEqual(result.rows.length, 0);
          resolve(result.rows[0]);
        })
        .catch(function (err) {
          reject(err);
        });

      });
    }
  },

  delete: function(user_id, type) {

    return when.promise(function(resolve, reject) {
      DBService.delete('onetimetoken', [
          { field: 'user_id = $', value: user_id },
          { field: 'type = $', value: type }
        ])
        .then(function() {
          resolve();
        })
        .catch(function(err) {
          reject(err);
        });
    })

  }

};
