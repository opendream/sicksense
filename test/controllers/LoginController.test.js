var request = require('supertest');
var when = require('when');
var pg = require('pg');
pg.defaults.application_name = 'sicksense_test';

describe('LoginController test', function() {

  describe('[POST] login', function() {
    before(function(done) {
      TestHelper.clearUsers()
        .then(TestHelper.clearAccessTokens)
        .then(function() {
          TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" })
            .then(function(user) {
              done();
            })
            .catch(function(err) {
              done(err);
            });
        })
        .catch(function(err) {
          done(err);
        });
    });

    after(function(done) {
      TestHelper.clearUsers()
        .then(TestHelper.clearAccessTokens)
        .then(function() {
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    it('should validate query parameters', function(done) {
      request(sails.hooks.http.app)
        .post('/login')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");
          res.body.meta.errorMessage.should.match(/is required/);
          res.body.meta.invalidFields.should.have.properties(['email', 'password']);

          done();
        });
    });

    it('should return forbidden if provided wrong password', function(done) {
      request(sails.hooks.http.app)
        .post('/login')
        .send({
          email: "siriwat@opendream.co.th",
          password: "12345555"
        })
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should return user data with accessToken after successful login', function(done) {
      request(sails.hooks.http.app)
        .post('/login')
        .send({
          email: "siriwat@opendream.co.th",
          password: "12345678"
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(200);
          res.body.response.accessToken.should.be.ok;

          done();
        });
    });
  });
});
