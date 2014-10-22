var request = require('supertest');
var when = require('when');


describe('NewsController test', function() {

  before(function(done) {
    TestHelper.clearAll()
      .then(done, done);
  });

  after(function(done) {
    TestHelper.clearAll()
      .then(done, done);
  });

  describe('[POST] /news', function() {

    it('should error when nothing is provided', function(done) {
      request(sails.hooks.http.app)
        .post('/news')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when title is longer than 100 characters', function(done) {
      request(sails.hooks.http.app)
        .post('/news')
        .send({
          title: '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890x',
          content: 'abcd'
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.title.match(/title.*must less than 100 characters/);
          done();
        });
    });

    it('should create news', function (done) {
      request(sails.hooks.http.app)
        .post('/news')
        .send({
          title: '소녀시대 Taeyeon expresses her dislike of standing in front of cameras',
          content: 'The episode showed an awkward Taeyeon during her first meeting with the production crew.'
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.id.should.ok;
          res.body.response.title.should.equal('소녀시대 Taeyeon expresses her dislike of standing in front of cameras');
          res.body.response.content.should.equal('The episode showed an awkward Taeyeon during her first meeting with the production crew.');
          res.body.response.createdAt.should.ok;
          res.body.response.updatedAt.should.ok;

          done();
        });
    });

  });

  describe('[GET] /news', function () {

    var news1, news2, news3;

    before(function(done) {
      TestHelper.clearAll()
        .then(function () {
          return TestHelper.createNews()
        })
        .then(function (_news) {
          news1 = _news;
          return TestHelper.createNews()
        })
        .then(function (_news) {
          news2 = _news;
          return TestHelper.createNews()
        })
        .then(function (_news) {
          news3 = _news;
          done();
        })
        .catch(done);
    });

    after(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should return news list', function(done) {
      request(sails.hooks.http.app)
        .get('/news')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.news.count.should.equal(3);
          res.body.response.news.items[0].id.should.equal(news3.id);
          res.body.response.news.items[1].id.should.equal(news2.id);
          res.body.response.news.items[2].id.should.equal(news1.id);
          done();
        });
    });

    it('should return error when offset and limit is not int', function(done) {
      request(sails.hooks.http.app)
        .get('/news')
        .query({
          offset: 'offset',
          limit: 'limit'
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.offset.match(/offset. is not valid/);
          res.body.meta.invalidFields.limit.match(/limit. is not valid/);
          done();
        });
    });

    it('should return news list with offset', function(done) {
      request(sails.hooks.http.app)
        .get('/news')
        .query({
          offset: 2
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.news.count.should.equal(3);
          res.body.response.news.items[0].id.should.equal(news1.id);
          done();
        });
    });

    it('should return news list with limit', function(done) {
      request(sails.hooks.http.app)
        .get('/news')
        .query({
          limit: 2
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.news.count.should.equal(3);
          res.body.response.news.items[0].id.should.equal(news3.id);
          res.body.response.news.items[1].id.should.equal(news2.id);
          done();
        });
    });

    it('should return news list with limit and offset', function(done) {
      request(sails.hooks.http.app)
        .get('/news')
        .query({
          offset: 1,
          limit: 1
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.news.count.should.equal(3);
          res.body.response.news.items[0].id.should.equal(news2.id);
          done();
        });
    });

  });

  describe('[POST] /news/:id', function () {

    var news;

    before(function(done) {
      TestHelper.clearAll()
        .then(function () {
          return TestHelper.createNews()
        })
        .then(function (_news) {
          news = _news;
          done();
        })
        .catch(done);
    });

    after(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should return news item', function (done) {
      request(sails.hooks.http.app)
        .get('/news/' + news.id)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.id.should.ok;
          res.body.response.title.should.equal(news.title);
          res.body.response.content.should.equal(news.content);
          res.body.response.createdAt.should.ok;
          res.body.response.updatedAt.should.ok;

          done();
        });
    });

    it('should error when get inexist news', function (done) {
      request(sails.hooks.http.app)
        .get('/news/' + 76867)
        .expect(404)
        .end(function(err, res) {
          if (err) return done(err);

          done();          
        });
    });

  });

  describe('[DELETE] /news/:id', function () {

    var news;

    before(function(done) {
      TestHelper.clearAll()
        .then(function () {
          return TestHelper.createNews()
        })
        .then(function (_news) {
          news = _news;
          done();
        })
        .catch(done);
    });

    after(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should delete news', function (done) {
      request(sails.hooks.http.app)
        .delete('/news/' + news.id)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          DBService.select('news', '*', [
            { field: 'id = $', value: news.id }
          ])
          .then(function(result) {
            result.rowCount.should.equal.to(0);
          })
          .finally(done);
          
        });
    });

    it('should error when delete inexist news', function (done) {
      request(sails.hooks.http.app)
        .delete('/news/' + news.id)
        .expect(404)
        .end(function(err, res) {
          if (err) return done(err);

          done();          
        });
    });

  });

});