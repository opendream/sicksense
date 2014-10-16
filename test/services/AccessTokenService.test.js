var when = require('when');

describe('AccessTokenService test', function() {
  var user;

  before(function(done) {
    TestHelper.clearAll()
      .then(function() {
        return TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" }, false);
      })
      .then(function(_user) {
        user = _user;
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

      AccessToken.find({ userId: user.id }).exec(function(err, result) {
        result.length.should.equal(0);

        AccessTokenService.refresh(user.id)
          .then(function(newAccessToken) {
            newAccessToken.should.be.ok;
            parseInt(newAccessToken.userId).should.equal(user.id);
            accessToken = newAccessToken;
            done();
          })
          .catch(function(err) {
            done(err);
          });
      });

    });

    it('should refresh token', function(done) {

      AccessToken.find({ userId: user.id }).exec(function(err, result) {
        result.length.should.equal(1);
        parseInt(result[0].userId).should.equal(user.id);
        result[0].token.should.equal(accessToken.token);

        AccessTokenService.refresh(user.id)
          .then(function(newAccessToken) {
            newAccessToken.should.be.ok;
            parseInt(newAccessToken.userId).should.equal(user.id);
            newAccessToken.token.should.not.equal(accessToken.token);
            done();
          })
          .catch(function(err) {
            done(err);
          });
      });

    });

  });

});
