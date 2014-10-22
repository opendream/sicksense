var when = require('when');

module.exports = {
  create: create,
  index: index,
  update: update,
  getNews: getNews,
  destroy: destroy
};


function create(req, res) {

  validate()
    .then(function () {

      var now = new Date();
      DBService
        .insert('news', [
          { field: '"title"', value: req.body.title },
          { field: '"content"', value: req.body.content },
          { field: '"createdAt"', value: now },
          { field: '"updatedAt"', value: now }
        ])
        .then(function (result) {
          return res.ok(result.rows[0]);
        })
        .catch(function (err) {
          return res.serverError(err);
        });
    })
    .catch(function(err) {
      res.serverError(err);
    });

  function validate() {
    return when.promise(function(resolve, reject) {
      req.checkBody('title', 'Title is required').notEmpty();
      req.checkBody('title', 'Title must less than 100 characters').isLength(1, 100);
      req.checkBody('content', 'Content is required').notEmpty();

      var errors = req.validationErrors();
      var paramErrors = req.validationErrors(true);
      if (errors) {
        res.badRequest(_.first(errors).msg, paramErrors);
        return reject(errors);
      }

      resolve();
    });
  }
}

function index(req, res) {
  validate()
    .then(function () {
      // TODO: ADD ORDERING
      params = _.extend({
        limit: 10,
        offset: 0
      }, req.query);

      DBService.select('news', '*', [], 'ORDER BY "updatedAt" DESC LIMIT ' + params.limit + ' OFFSET ' + params.offset)
        .then(function (result) {

          var news = result.rows;
          DBService.select('news', '*', [])
            .then(function (result) {
              return res.ok({
                news: {
                  count: result.rowCount,
                  items: news
                }
              });
            })
            .catch(function (err) {
              return res.serverError(err);
            });
        })
        .catch(function (err) {
          return res.serverError(err);
        });

    })
    .catch( function (err) {
      res.serverError(err);
    });

  function validate() {
    return when.promise(function (resolve, reject) {
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
        return reject(errors);
      }

      resolve();
    });
  }
}

function update(req, res) {

  validate()
    .then(function () {

      var data = [
        { field: '"updatedAt" = $', value: new Date() }
      ];

      if (req.body.title) {
        data.push({
          field: '"title" = $',
          value: req.body.title
        });
      }
      if (req.body.content) {
        data.push({
          field: '"content" = $',
          value: req.body.content
        });
      }

      var conditions = [
        { field: 'id = $', value: req.params.news_id }
      ];

      DBService.update('news', data, conditions)
        .then(function (result) {
          return res.ok(result.rows[0]);
        })
        .catch(function (err) {
          return res.serverError(err);
        })
    })
    .catch(function(err) {
      res.serverError(err);
    });

  function validate() {
    return when.promise(function(resolve, reject) {
      req.checkBody('title', 'Title is required').notEmpty();
      req.checkBody('title', 'Title must less than 100 characters').isLength(1, 100);
      req.checkBody('content', 'Content is required').notEmpty();

      var errors = req.validationErrors();
      var paramErrors = req.validationErrors(true);
      if (errors) {
        res.badRequest(_.first(errors).msg, paramErrors);
        return reject(errors);
      }

      resolve();
    });
  }
}

function getNews(req, res) {
  getNews()
    .then(function (news) {
      if (news) {
        return res.ok(news);

      } else {
        return res.notFound("News not found");
      }
    })
    .catch(function (err) {
      return res.serverError(err);
    })

  function getNews() {
    return when.promise(function(resolve, reject) {
      DBService.select('news', '*', [
        { field: 'id = $', value: req.params.news_id }
      ])
      .then(function (result) {
        resolve(result.rows[0])
      })
      .catch(function (err) {
        reject(err);
      })
    });
  }
}

function destroy(req, res) {
  getNews()
    .then(function (news) {
      if (news) {
        DBService.delete('news', [
          { field: 'id = $', value: news.id },
        ])
        .then(function () {
          return res.ok();
        })
        .catch(function (err) {
          return res.serverError(err);
        });

      } else {
        return res.notFound("News not found");
      }
    })
    .catch(function (err) {
      return res.serverError(err);
    })

  function getNews() {
    return when.promise(function(resolve, reject) {
      DBService.select('news', '*', [
        { field: 'id = $', value: req.params.news_id }
      ])
      .then(function (result) {
        resolve(result.rows[0])
      })
      .catch(function (err) {
        reject(err);
      })
    });
  }
}
