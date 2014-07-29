
module.exports = {
  index: index,
  create: create,
  destroy: destroy
};

function index(req, res) {

}

function create(req, res) {
  validate();
  run();

  function run() {
    pg.connect(sails.config.connections.postgresql.connectionString, function (err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        res.serverError("Could not connection to the database", err);
        return;
      }

      var queryData = queryBuilder(req.body);
      client.query(queryData.query, queryData.values, function (err, result) {
        if (err) {
          sails.log.error(err);
          res.serverError("Server error", err);
          return;
        }

        var values = [
          req.body.published,
          req.body.body,
          req.body.gender,
          req.body.age_start,
          req.body.age_stop,
          req.body.province,
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
          if (err) {
            sails.log.error(err);
            res.serverError("Server error", err);
            return;
          }

          if (!req.body.published) {
            // Send now.
            // NoticationsService.send(result.rows[0].id);
          }

          res.ok({
            notification: result.rows[0]
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

    if (params.gender != 'all') {
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
    console.log(wheres, values);

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

}
