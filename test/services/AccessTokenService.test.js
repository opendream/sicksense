var when = require('when');

describe('AccessTokenService test', function() {
  var data = {};

  before(function(done) {
    TestHelper.clearAll()
      .then(function() {
        return TestHelper.createSicksenseID({
          email: 'siriwat@opendream.co.th',
          password: '12345678'
        });
      })
      .then(function (sicksenseID) {
        data.sicksenseID = sicksenseID;
      })
      .then(function() {
        return TestHelper.createUser({
          email: "A001@sicksense.org",
          password: "A001"
        }, false);
      })
      .then(function(_user) {
        data.user = _user;
      })
      .then(function() {
        return TestHelper.createUser({
          email: "A002@sicksense.org",
          password: "A002"
        }, true);
      })
      .then(function(_user) {
        data.user2 = _user;
      })
      .then(function () {
        return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user);
      })
      .then(function () {
        return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user2);
      })
      .then(function () {
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  after(function(done) {
    TestHelper.clearAll()
      .then(done, done);
  });

  describe('refresh()', function() {
    var accessToken;

    it('should create new token', function(done) {

      AccessToken.find({ userId: data.user.id }).exec(function(err, result) {
        result.length.should.equal(0);

        AccessTokenService.refresh(data.user.id)
          .then(function (newAccessToken) {
            newAccessToken.should.be.ok;
            parseInt(newAccessToken.userId).should.equal(data.user.id);
            data.user.accessToken = newAccessToken;
            done();
          })
          .catch(function(err) {
            done(err);
          });
      });

    });

    it('should refresh token', function(done) {

      AccessToken.find({ userId: data.user.id }).exec(function(err, result) {
        result.length.should.equal(1);
        result[0].token.should.equal(data.user.accessToken.token);

        AccessTokenService.refresh(data.user.id)
          .then(function (newAccessToken) {
            newAccessToken.should.be.ok;
            parseInt(newAccessToken.userId).should.equal(data.user.id);
            newAccessToken.token.should.not.equal(data.user.accessToken.token);
            done();
          })
          .catch(function(err) {
            done(err);
          });
      });

    });

  });

  describe('delete()', function() {

    it('should delete token from user', function (done) {

      AccessTokenService.refresh(data.user.id)
        .then(function (newAccessToken) {
          return AccessTokenService.delete(data.user.id);
        })
        .then(function () {
          AccessToken.find({ userId: data.user.id }).exec(function(err, result) {
            if (err) return done(err);
            result.length.should.equal(0);
            done();
          });
        })
        .catch(function (err) {
          done(err);
        });

    });

  });

  describe('clearAllBySicksenseId()', function() {

    it('should clear all users\'s token', function (done) {

      AccessTokenService.refresh(data.user.id)
        .then(function (newAccessToken) {
          return AccessTokenService.refresh(data.user2.id)
        })
        .then(function (newAccessToken) {
          return AccessTokenService.clearAllBySicksenseId(data.sicksenseID.id);
        })
        .then(function () {
          return UserService.getUsersBySicksenseId(data.sicksenseID.id);
        })
        .then(function (users) {
          return when.map(users, function(user) {
            return AccessToken.find({ userId: user.id }).exec(function(err, result) {
              if (err) return done(err);
              result.length.should.equal(0);
            });
          });
        })
        .then(function () {
          done();
        })
        .catch(function (err) {
          done(err);
        });

    });

  });

});
