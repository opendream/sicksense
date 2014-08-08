var when = require('when');

module.exports = {
  index: index,
  create: create,
  destroy: destroy
};

function index(req, res) {
  if (validate()) run();

  function run() {
    params = _.extend({
      limit: 10,
      offset: 0
    }, req.query);

    pg.connect(sails.config.connections.postgresql.connectionString, function (err, client, pgDone) {
      var notifications = [];
      var count = 0;

      if (err) {
        sails.log.error(err);
        return res.serverError('Server error', err);
      }

      var values = [ params.limit, params.offset ];
      client.query("\
        SELECT \
          id, published, body, gender, age_start, age_stop, province, status, \"createdAt\", \"updatedAt\" \
        FROM \
          notifications \
        ORDER BY \"createdAt\" DESC \
        LIMIT $1 \
        OFFSET $2 \
      ", values, function (err, result) {
        if (err) {
          sails.log.error(err);
          return res.serverError('Server error', err);
        }

        notifications = result.rows;

        client.query("SELECT count(id) as count FROM notifications", [], function (err, result) {
          pgDone();

          if (err) {
            sails.log.error(err);
            return res.serverError('Server error', err);
          }

          res.ok({
            notifications: {
              count: result.rows[0].count,
              items: notifications
            }
          });
        });
      });
    });
  }

  function validate() {
    if (req.query.limit) {
      req.checkQuery('limit', '`limit` field is not valid').isInt();
    }
    if (req.query.offset) {
      req.checkQuery('offset', '`offset` field is not valid').isInt();
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      res.badRequest(_.first(errors).msg, paramErrors);
      return false;
    }

    return true;
  }
}

function create(req, res) {
  if (validate()) run();

  function run() {
    pg.connect(sails.config.connections.postgresql.connectionString, function (err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        return res.serverError("Server error", err);
      }

      var queryData = queryBuilder(req.body);
      client.query(queryData.query, queryData.values, function (err, result) {
        if (err) {
          sails.log.error(err);
          return res.serverError("Server error", err);
        }

        var data = [
          { field: 'published', value: req.body.publised },
          { field: 'body', value: req.body.body },
          { field: 'link', value: req.body.link },
          { field: 'gender', value: req.body.gender },
          { field: 'age_start', value: req.body.age_start },
          { field: 'age_stop', value: req.body.age_stop },
          { field: 'province', value: req.body.city },
          {
            field: 'crondata',
            value: JSON.stringify({
              users: result.rows
            })
          },
          { field: '"createdAt"', value: new Date() },
          { field: '"updatedAt"', value: new Date() }
        ];

        DBService.insert('notifications', data)
          .then(function (result) {
            var promise = when.resolve(result.rows[0]);

            if (!req.body.published) {
              // Send now.
              promise = NotificationsService.push(result.rows[0]);
            }

            promise
              .then(function (notification) {
                res.ok({
                  notification: NotificationsService.getJSON(notification)
                });
              })
              .catch(function (err) {
                sails.log.error('[NotificationController]', err);
                res.ok({
                  notification: NotificationsService.getJSON(result.rows[0])
                });
              });
          })
          .catch(function (err) {
            sails.log.error(err);
            return res.serverError("Server error", err);
          });
      });
    });
  }

  function queryBuilder(params) {
    params = _.extend({
      published: null,
      gender: 'all',
      age_start: null,
      age_stop: null,
      city: null
    }, params);

    var wheres = [ ' d.id IS NOT NULL ' ];
    var values = [];
    var index = 1;

    var query = "\
      SELECT u.id as user_id, d.id as device_id, d.platform \
      FROM users u INNER JOIN devices d ON u.id::varchar = d.user_id ";

    if (params.gender != 'all' && (params.gender && params.gender !== null)) {
      wheres.push(" gender = $" + index++);
      values.push(params.gender);
    }

    var thisYear = (new Date()).getFullYear();
    if (params.age_start) {
      wheres.push(" \"birthYear\" <= $" + index++);
      values.push(thisYear - params.age_start);
    }
    if (params.age_stop) {
      wheres.push(" \"birthYear\" >= $" + index++);
      values.push(thisYear - params.age_stop);
    }

    if (params.city) {
      wheres.push(" city = $" + index++);
      values.push(params.city);
    }

    if (!_.isEmpty(wheres)) {
      query += " WHERE " + wheres.join(' AND ');
    }

    return {
      query: query,
      values: values
    };
  }

  function validate() {
    req.checkBody('body', '`body` field is required').notEmpty();
    if (req.body.gender) {
      req.checkBody('gender', '`gender` field is not valid').isIn(['all', 'male', 'female']);
    }
    if (req.body.age_start) {
      req.checkBody('age_start', '`age_start` field is not valid').isInt().isBetween(0, 200);
      req.sanitize('age_start').toInt();
    }
    if (req.body.age_stop) {
      req.checkBody('age_stop', '`age_stop` field is not valid').isInt().isBetween(0, 200);
      req.sanitize('age_stop').toInt();
    }
    if (req.body.age_start && req.body.age_stop) {
      req.checkBody('age_start', '`age_start` field must not greater than `age_stop`').isBetween(0, req.body.age_stop);
    }
    if (req.body.published) {
      req.checkBody('published', '`published` field is not valid date').isDate();
    }

    var errors = req.validationErrors();
    var paramErrors = req.validationErrors(true);
    if (errors) {
      res.badRequest(_.first(errors).msg, paramErrors);
      return false;
    }

    return true;
  }
}

function destroy(req, res) {
  if (req.notification) {
    pg.connect(sails.config.connections.postgresql.connectionString, function (err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        return res.serverError("Server error", err);
      }

      var query;
      var values;

      if (!req.query.permanent) {
        query = "UPDATE notifications SET status = $1 WHERE id = $2";
        values = [
          NotificationsService.STATUS.deleted,
          req.notification.id
        ];
        client.query(query, values, function (err, result) {
          if (err) {
            sails.log.error(err);
            return res.serverError("Server error", err);
          }

          req.notification.status = NotificationsService.STATUS.deleted;
          res.ok({
            notification: req.notification
          });
        });
      }
      else {
        query = "DELETE FROM notifications WHERE id = $1";
        values = [
          req.notification.id
        ];
        client.query(query, values, function (err, result) {
          if (err) {
            sails.log.error(err);
            return res.serverError("Server error", err);
          }

          req.notification.status = NotificationsService.STATUS.deleted;
          res.ok({
            notification: req.notification
          });
        });
      }
    });
  }
  else {
    res.notFound("Notification not found");
  }
}
