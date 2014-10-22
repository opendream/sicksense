var when = require('when');

module.exports = {
  create: create,
  get: get
};

function create(title, content) {
  return when.promise(function (resolve, reject) {

    var now = new Date();
    DBService
      .insert('news', [
        { field: '"title"', value: title },
        { field: '"content"', value: content },
        { field: '"createdAt"', value: now },
        { field: '"updatedAt"', value: now }
      ])
      .then(function (result) {
        resolve(result.rows[0]);
      })
      .catch(function (err) {
        reject(err);
      });
  });
}


function get(newsID) {
  return when.promise(function(resolve, reject) {
    DBService.select('news', '*', [
      { field: 'id = $', value: newsID }
    ])
    .then(function (result) {
      resolve(result.rows[0])
    })
    .catch(function (err) {
      reject(err);
    })
  });
}