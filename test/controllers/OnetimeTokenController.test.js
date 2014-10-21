var request = require('supertest');
var when = require('when');

describe('OnetimeTokenController test', function() {
  var sicksenseID, sicksenseID2, onetimeToken, onetimeToken2;

  before(function(done) {
    TestHelper.clearAll()
      .then(function() {
        return TestHelper.createSicksenseID({ email: "john@example.com", password: "12345678" });
      })
      .then(function(_user) {
        sicksenseID = _user;
      })
      .then(function() {
        return OnetimeTokenService.create('test', sicksenseID.id, sails.config.onetimeToken.lifetime);
      })
      .then(function(_onetimeToken) {
        onetimeToken = _onetimeToken;
      })
      .then(function() {
        return TestHelper.createSicksenseID({ email: "adam@example.com", password: "12345678" });
      })
      .then(function(_user) {
        sicksenseID2 = _user;
      })
      .then(function() {
        return OnetimeTokenService.create('test', sicksenseID2.id, -1000);
      })
      .then(function(_onetimeToken) {
        onetimeToken2 = _onetimeToken;
      })
      .then(done)
      .catch(done);
  });

  after(function(done) {
    TestHelper.clearAll()
      .then(done, done);
  });

  describe('[POST] /onetimetoken/validate', function() {

    it('should error when nothing is provided', function(done) {
      request(sails.hooks.http.app)
        .post('/onetimetoken/validate')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when token is provided but type', function(done) {
      request(sails.hooks.http.app)
        .post('/onetimetoken/validate')
        .send({ token: '12345678' })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when type is provided but token', function(done) {
      request(sails.hooks.http.app)
        .post('/onetimetoken/validate')
        .send({ type: 'test' })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when token and type is provided but it does not exists', function(done) {
      request(sails.hooks.http.app)
        .post('/onetimetoken/validate')
        .send({ token: 'invalid token', type: 'test' })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when found but token is expired', function(done) {
      request(sails.hooks.http.app)
        .post('/onetimetoken/validate')
        .send({ token: onetimeToken2.token, type: onetimeToken2.type })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should return one time token.', function(done) {
      request(sails.hooks.http.app)
        .post('/onetimetoken/validate')
        .send({ token: onetimeToken.token, type: onetimeToken.type })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

  });

});
