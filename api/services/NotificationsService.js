
module.exports = {
  getJSON: getJSON
};

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
