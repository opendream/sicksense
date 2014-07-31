var when = require('when');

var STATUS = {
  'pending': 0,
  'sent': 1,
  'fail': 2,
  'deleted': 3
};

var apn = require('apn');
var apnService;

module.exports = {
  STATUS: STATUS,
  getJSON: getJSON,
  push: push
};

function init() {
  if (apnService) return;

  apnService = new apn.connection({
    cert: sails.config.apn.cert,
    key: sails.config.apn.key,
    retryLimit: sails.config.apn.retryLimit
  });

  apnService.on('transmissionError', function (errCode, notification, device) {
    if (errCode == 8) {

      var device_id = (device.token && device.token.toString('binary')) || device.toString();

      sails.log.info('[Notification] can not send message to device:', device_id, '.. removing.');

      DBService.delete('devices', [
        { field: 'id = $', value: device_id }
      ]);
    }
  });

  apnService.on('transmitted', function (notification, device) {
    var notification_id = notification.payload.notification_id;

    var updates = [
      { field: 'status = $', value: NotificationsService.STATUS.sent }
    ];

    var conditions = [
      { field: 'id = $', value: notification_id },
      { field: 'status <> $', value: NotificationsService.STATUS.deleted },
      { field: 'status <> $', value: NotificationsService.STATUS.sent }
    ];

    DBService.update('notifications', updates, conditions);
  });
}

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

function push(notification) {
  pushIOS(notification);
}

function pushIOS(notification) {
  init();

  var devices = _.pluck(_.filter(notification.crondata.users, { platform: 'ios' }), 'device_id');

  return when.promise(function (resolve, reject) {
    var note = new apn.notification();

    note.setAlertText(notification.body);
    note.payload.notification_id = notification.id;

    apnService.pushNotification(note, devices);
  });
}
