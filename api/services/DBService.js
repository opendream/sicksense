var util = require('util');
var when = require('when');

module.exports = {
  insert: insert,
  update: update,
  delete: _delete
};

function insert(table, data) {
  var fields = _.pluck(data, 'field');
  var values = _.pluck(data, 'value');
  var placeholders = _.map(_.range(values.length), function (i) {
    return '$' + (i + 1);
  });

  var query = util.format("INSERT INTO %s (%s) VALUES (%s) RETURNING *", table, fields.join(','), placeholders.join(','));

  return when.promise(function (resolve, reject) {

    pgconnect()
      .then(function (conn) {
        conn.client.query(query, values, function (err, result) {
          conn.done();

          if (err) return reject(err);

          resolve(result);
        });
      })
      .catch(function (err) {
        reject(err);
      });

  });

}

function update(table, data, conditions) {
  var sets = [];
  var wheres = [];
  var values = [];

  var index = 1;

  sets = _.map(data, function (item) {
    values.push(item.value);
    return item.field.replace(/\$/, '$' + index++);
  });

  wheres = _.map(conditions, function (item) {
    values.push(item.value);
    return item.field.replace(/\$/, '$' + index++);
  });

  var query = util.format("UPDATE %s SET %s WHERE %s RETURNING *", table, sets.join(','), wheres.join(' AND '));

  return when.promise(function (resolve, reject) {

    pgconnect()
      .then(function (conn) {
        conn.client.query(query, values, function (err, result) {
          conn.done();

          if (err) return reject(err);

          resolve(result);
        });
      })
      .catch(function (err) {
        reject(err);
      });

  });
}

function _delete(table, conditions) {
  var values = [];

  var conditionStr = _.map(_.range(conditions.length), function (index) {
    var item = conditions[index];

    values.push(item.value);
    return item.field.replace(/\$/, '$' + (index + 1));
  }).join(' AND ');

  var query = util.format("DELETE FROM %s WHERE %s RETURNING *", table, conditionStr);

  return when.promise(function (resolve, reject) {

    pgconnect()
      .then(function (conn) {
        conn.client.query(query, values, function (err, result) {
          conn.done();

          if (err) return reject(err);

          resolve(result);
        });
      })
      .catch(function (err) {
        reject(err);
      });

  });
}