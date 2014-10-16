var assert = require('assert');
var passgen = require('password-hash-and-salt');
var when = require('when');

module.exports = {
  updatePassword: updatePassword,
  getUserByEmailPassword: getUserByEmailPassword,
  getAccessToken: getAccessToken,
  getUserByID: getUserByID,
  getUserByEmail: getUserByEmail,
  getUserJSON: getUserJSON,
  getDevices: getDevices,
  getDefaultDevice: getDefaultDevice,
  setDevice: setDevice,
  clearDevices: clearDevices,
  removeDefaultUserDevice: removeDefaultUserDevice,
  verify: verify
};

function updatePassword(userId, newPassword, shouldRefreshAccessToken) {
  var user;
  return when.promise(function(resolve, reject) {
    // Validate user.
    return DBService.select('users', '*', [{ field: 'id = $', value: userId }])
      .then(function(result) {
        assert.notEqual(result.rows.length, 0);
        return result.rows[0];
      })
      // Update password.
      .then(function(user) {
        passgen(newPassword).hash(sails.config.session.secret, function(err, hashedPassword) {
          var values = [{ field: 'password = $', value: hashedPassword }];
          var conditions = [{ field: 'id = $', value: user.id }];
          DBService.update('users', values, conditions)
            .then(function(result) {
              var user = result.rows[0];

              // Need refresh access token.
              if (shouldRefreshAccessToken) {
                AccessTokenService.refresh(user.id)
                  .then(function(freshAccessToken) {
                    resolve(UserService.getUserJSON(user, {accessToken: freshAccessToken.token }));
                  })
                  .catch(function(err) {
                    reject(err);
                  });
              }
              else {
                AccessToken.findOneByUserId(user.id).exec(function(err, result) {
                  if (err) return reject(err);
                  resolve(UserService.getUserJSON(user, {accessToken: result.token}));
                });
              }
            })
            .catch(function(err) {
              reject(err);
            });
        });
      })
      .catch(function(err) {
        reject(err);
      })
  });
}

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

function getUserByEmail(client, email) {
  return when.promise(function(resolve, reject) {
    client.query('SELECT * FROM users WHERE email=$1', [ email ], function(err, result) {
      if (err) return reject(err);
      if (result.rows.length === 0) return reject('User not found');

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

function getUserJSON (user, extra) {
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
    },
    platform: user.platform
  }, extra);
}

function setDevice(user, device) {
  // Find if this device already linked with someone.
  var existingDevice;

  return when.promise(function (resolve, reject) {
    var now = (new Date()).getTime();
    return pgconnect()
      .then(function (conn) {
        sails.log.debug('[ReportService:setDevice]', now);
        return when.promise(function (resolve, reject) {
          var query = "SELECT * FROM devices WHERE id = $1";
          var values = [ device.id ];

          conn.client.query(query, values, function (err, result) {
            conn.done();
            sails.log.debug('[ReportService:setDevice]', now);

            if (err) return reject(err);

            existingDevice = result.rows[0];
            resolve();
          });
        });
      })
      .then(function () {
        if (existingDevice) {
          device.user_id = user.id;
          device = _.extend(existingDevice, device);

          // Do update.
          var updates = _.map(_.keys(device), function (key) {
            return {
              field: '"' + key + '" = $',
              value: device[key]
            };
          });
          var conditions = [
            { field: 'id = $', value: device.id }
          ];

          return DBService.update('devices', updates, conditions);
        }
        else {
          device = _.extend({
            platform: 'doctormeios',
            subscribePushNoti: true,
            subscribePushNotiType: 0
          }, device);

          // Do insert
          var data = [
            { field: 'id',                      value: device.id },
            { field: 'platform',                value: device.platform },
            { field: 'user_id',                 value: user.id },
            { field: 'subscribe_pushnoti',      value: device.subscribePushNoti },
            { field: 'subscribe_pushnoti_type', value: device.subscribePushNotiType },
            { field: '"createdAt"',             value: new Date() },
            { field: '"updatedAt"',             value: new Date() }
          ];

          return DBService.insert('devices', data);
        }
      })
      .then(function (result) {
        resolve(result.rows[0]);
      })
      .catch(function (err) {
        reject(err);
      });
  });
}

function removeDefaultUserDevice(user) {
  return getDevices(user)
    .then(function (devices) {
      if (devices.length > 0) {
        return removeDevice(devices[0].id);
      }
      else {
        return when.resolve();
      }
    });
}

function removeDevice(device_id) {
  return when.promise(function (resolve, reject) {
    return DBService.delete('devices', [
      { field: 'id = $', value: device_id }
    ])
    .then(function (result) {
      resolve(result.rows[0]);
    })
    .catch(function (err) {
      reject(err);
    });
  });
}

function clearDevices(user) {
  return DBService.delete('devices', [
    { field: 'user_id = $', value: user.id }
  ]);
}

function getDevices(user) {
  return when.promise(function (resolve, reject) {

    pgconnect()
      .then(function (conn) {
        conn.client.query("SELECT * FROM devices WHERE user_id = $1", [ user.id ], function (err, result) {
          conn.done();
          if (err) return reject(err);

          resolve(result.rows);
        });
      })
      .catch(function (err) {
        reject(err);
      });

  });
}

function getDefaultDevice(user) {
  return getDevices(user)
    .then(function (devices) {
      return when.promise(function (resolve) {
        resolve(devices[0]);
      });
    });
}

function getDevice(device_id) {
  return when.promise(function (resolve, reject) {

    pgconnect()
      .then(function (conn) {
        conn.client.query("SELECT * FROM devices WHERE id = $1", [ device_id ], function (err, result) {
          conn.done();
          if (err) return reject(err);

          resolve(result.rows[0]);
        });
      })
      .catch(function (err) {
        reject(err);
      });

  });
}

function subscribePushNoti(user, device_id) {
  return setSubscribePushNoti(user, device_id, true);
}

function unsubscribePushNoti(user, device_id) {
  return setSubscribePushNoti(user, device_id, false);
}

function setSubscribePushNoti(user, device_id, subscribe) {
  return when.promise(function (resolve, reject) {
    var updates = [
      { field: 'subscribe_pushnoti', value: !!subscribe }
    ];

    var conditions = [
      { field: 'id', value: device_id }
    ];

    DBService.update('devices', updates, conditions)
      .then(function (result) {
        resolve(result.rows[0]);
      })
      .catch(function (err) {
        reject(err);
      });
  });
}

function setDefaultDeviceSubscribePushNoti(user, subscribe) {
  return getDevices(user)
    .then(function (devices) {
      if (devices[0].id) {
        return setSubscribePushNoti(user, devices[0].id, subscribe);
      }
    });
}

function verify(user_id) {
  return DBService.select('sicksense_users', 'sicksense_id', [
    { field: 'user_id = $', value: user_id }
  ])
  .then(function (result) {
    if (result.rows.length !== 0) {
      return DBService.update('sicksense', [
        { field: 'is_verify = $', value: 't' }
      ], [
        { field: 'id = $' , value: result.rows[0].sicksense_id }
      ]);
    }
    else {
      return when.resolve();
    }
  });
}
