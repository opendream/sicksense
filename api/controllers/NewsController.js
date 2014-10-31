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
      return NewsService.create(req.body.title, req.body.content)
    })
    .then(function (news) {
      res.ok(news);
    })
    .catch(function(err) {
      res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });

  function validate() {
    return when.promise(function(resolve, reject) {
      req.checkBody('title', 'หัวข้อต้องกรอก').notEmpty();
      req.checkBody('title', 'หัวข้อต้องยาวไม่เกิน 100 ตัวอักษร').isLength(1, 100);
      req.checkBody('content', 'เนื้อหาต้องกรอก').notEmpty();

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
              return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
            });
        })
        .catch(function (err) {
          return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });

    })
    .catch( function (err) {
      res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
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
          return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        })
    })
    .catch(function(err) {
      res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });

  function validate() {
    return when.promise(function(resolve, reject) {
      req.checkBody('title', 'หัวข้อต้องกรอก').notEmpty();
      req.checkBody('title', 'หัวข้อต้องยาวไม่เกิน 100 ตัวอักษร').isLength(1, 100);
      req.checkBody('content', 'เนื้อหาต้องกรอก').notEmpty();

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
  NewsService.get(req.params.news_id)
    .then(function (news) {
      if (news) {
        return res.ok(news);

      } else {
        return res.notFound("ไม่พบข่าว");
      }
    })
    .catch(function (err) {
      return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
}

function destroy(req, res) {
  NewsService.get(req.params.news_id)
    .then(function (news) {
      if (news) {
        DBService.delete('news', [
          { field: 'id = $', value: news.id },
        ])
        .then(function () {
          return res.ok();
        })
        .catch(function (err) {
          return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });

      } else {
        return res.notFound("ไม่พบข่าว");
      }
    })
    .catch(function (err) {
      return res.serverError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
}
