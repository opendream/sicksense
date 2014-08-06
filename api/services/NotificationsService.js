var when = require('when');

var STATUS = {
  'pending': 0,
  'sent': 1,
  'fail': 2,
  'deleted': 3,
  'processing': 4
};

var apn = require('apn');

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
  return updateStatus(notification, STATUS.processing)
    .then(function () {
      return pushIOS(notification);
    });
}

function pushIOS(notification, tag) {
  tag = tag || '';

  var devices = _.pluck(_.filter(notification.crondata.users, { platform: 'ios' }), 'device_id');
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
