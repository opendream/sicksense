
module.exports = {
  index: index,
  create: create,
  destroy: destroy
};

function index(req, res) {
  validate();
  run();

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
      return res.badRequest(_.first(errors).msg, paramErrors);
    }
  }
}

function create(req, res) {
  validate();
  run();

  function run() {
    pg.connect(sails.config.connections.postgresql.connectionString, function (err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        return res.serverError("Server error", err);
      }

      var queryData = queryBuilder(req.body);
      client.query(queryData.query, queryData.values, function (err, result) {
        if (err) return res.serverError("Server error", err);

        var values = [
          req.body.published,
          req.body.body,
          req.body.gender,
          req.body.age_start,
          req.body.age_stop,
          req.body.city,
          JSON.stringify({
            users: result.rows
          }),
          new Date(),
          new Date()
        ];

        client.query("\
          INSERT INTO notifications \
          ( published, body, gender, \
            age_start, age_stop, province, crondata, \"createdAt\", \"updatedAt\" ) \
          VALUES \
          ( $1, $2, $3, $4, $5, $6, $7, $8, $9 ) RETURNING * \
        ", values, function (err, result) {
          pgDone();

          if (err) {
            sails.log.error(err);
            return res.serverError("Server error", err);
          }

          if (!req.body.published) {
            // Send now.
            // NoticationsService.send(result.rows[0].id);
          }

          res.ok({
            notification: NotificationsService.getJSON(result.rows[0])
          });
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

    var wheres = [];
    var values = [];
    var index = 1;

    var query = " SELECT email FROM users ";

    if (params.gender != 'all' || params.gender !== null) {
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
      return res.badRequest(_.first(errors).msg, paramErrors);
    }
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