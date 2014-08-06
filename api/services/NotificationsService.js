var when = require('when');
var parallel = require('when/parallel');

var STATUS = {
  'pending': 0,
  'sent': 1,
  'fail': 2,
  'deleted': 3,
  'processing': 4
};

var apn = require('apn');
var gcm = require('node-gcm');

module.exports = {
  STATUS: STATUS,
  getJSON: getJSON,
  push: push,
  getAPNService: getAPNService
};

var getAPNService = function () {

  var apnService;

  return function (options, newInstant) {
    var defaults = {
      cert: sails.config.apn.cert,
      key: sails.config.apn.key,
      retryLimit: sails.config.apn.retryLimit
    };

    if (newInstant) {
      return new apn.connection(_.extend(defaults, options));
    }
    else {

      if (!apnService) {
        apnService = new apn.connection(_.extend(defaults, options));
      }
      return apnService;
    }
  };
}();

var getGCMService = function () {
  var gcmService;

  return function (options, newInstant) {
    var defaults = _.extend(sails.config.gcm, options);

    if (newInstant) {
      return new gcm.Sender(defaults.key);
    }
    else {
      if (!gcmService) {
        gcmService = new gcm.Sender(defaults.key);
      }
      return gcmService;
    }
  };
}();

function getJSON(notification, extra) {
  extra = extra || {};

  return _.assign({
    id: notification.id,
    published: notification.published,
    body: notification.body,
    gender: notification.gender,
    age_start: notification.age_start,
    age_stop: notification.age_stop,
    province: notification.province,
    status: notification.status,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt
  }, extra);
}

function updateStatus(notification, status) {
  return DBService
    .update('notifications', [
      { field: 'status = $', value: status }
    ], [
      { field: 'id = $', value: notification.id }
    ]);
}

function push(notification) {
  return when.promise(function (resolve, reject) {
    updateStatus(notification, STATUS.processing)
      .then(function () {
        return parallel(
          pushIOS(notification),
          pushAndroid(notification
        ));
      })
      .then(function () {
        pgconnect()
          .then(function (conn) {
            conn.client.query("SELECT * FROM notifications WHERE id = $1", [ notification.id ], function (err, result) {
              conn.done();

              if (err) {
                sails.log.error('[Notification]', err);
                return resolve(notification);
              }

              resolve(result.rows[0]);
            });
          })
          .catch(function (err) {
            if (err) {
              sails.log.error('[Notification]', err);
              return;
            }

            resolve(notification);
          });
      })
      .catch(function (err) {
        sails.log.error('[Notification]', err);
        resolve(notification);
      });
  });
}

function pushIOS(notification, tag) {
  tag = tag || '';

  var devices = _.pluck(_.filter(notification.crondata.users, { platform: 'doctormeios' }), 'device_id');
  if (_.isEmpty(devices)) {
    return updateStatus(notification, STATUS.sent)
      .then(function (notification) {
        return when.resolve(notification);
      });
  }

  return when.promise(function (resolve, reject) {
    var note = new apn.notification();

    note.setAlertText(notification.body);
    note.payload.notification_id = notification.id;

    var apnService = getAPNService({}, true);

    apnService.on('transmissionError', function (errCode, notification, device) {
      if (errCode == 8) {

        var device_id = (device.token && device.token.toString('binary')) || device.toString();

        sails.log.info('[Notification] ' + tag + ' can not send message to device:', device_id, '.. removing.');

        DBService.delete('devices', [
          { field: 'id = $', value: device_id }
        ]);
      }
    });

    apnService.on('error', function (err) {
      sails.log.error('[Notification] ' + tag + ' Connection error', err);

      updateStatus(notification, STATUS.pending)
        .then(function () {
          reject(err);
        });
    });

    apnService.on('socketError', function (err) {
      sails.log.error('[Notification] ' + tag + ' ANPS socket error', err);

      updateStatus(notification, STATUS.pending)
        .then(function () {
          reject(err);
        });
    });

    apnService.on('timeout', function () {
      sails.log.error('[Notification] ' + tag + ' ANPS connection timeout');

      updateStatus(notification, STATUS.pending)
        .then(function () {
          reject(new Error("APNS timeout"));
        });
    });

    apnService.on('connected', function () {
      sails.log.info('[Notification] ' + tag + ' connected with APNS');

      updateStatus(notification, STATUS.sent)
        .then(function (result) {
          resolve(result.rows[0]);
        });
    });

    apnService.pushNotification(note, devices);
  });
}

function pushAndroid(notification, tag) {
  tag = tag || '';

  var devices = _.pluck(_.filter(notification.crondata.users, { platform: 'doctormeandroid' }), 'device_id');
  if (_.isEmpty(devices)) {
    return updateStatus(notification, STATUS.sent)
      .then(function (notification) {
        return when.resolve(notification);
      });
  }

  return when.promise(function (resolve, reject) {
    var gcmService = getGCMService({}, true);

    var message = new gcm.Message(sails.config.gcm.options);
    message.addDataWithKeyValue('message', notification.body);

    gcmService.send(message, devices, sails.config.retries, function (err, result) {
      if (err) {
        sails.log.error('[Notification] ' + tag + ' error connected with GCM', err);
        return reject(err);
      }

      updateStatus(notification, STATUS.sent)
        .then(function (result) {
          sails.log.info('[Notification] ' + tag + ' sent to GCM');

          resolve(result.rows[0]);
        });
    });
  });
}
