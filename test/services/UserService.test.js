var when = require('when');
var passgen = require('password-hash-and-salt');

describe('UserService test', function() {

  describe('updatePassword()', function() {
    var user, accessToken;

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" }, true);
        })
        .then(function(_user) {
          user = _user;
          accessToken = user.accessToken;
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });

    afterEach(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should update password and refresh access token', function(done) {

      var newPassword = 'qwerasdf';
      UserService.updatePassword(user.id, newPassword, true)
        .then(function(updatedUser) {
          updatedUser.accessToken.should.not.equal(accessToken);

          DBService.select('users', '*', [
              { field: 'id = $', value: user.id }
            ])
            .then(function(result) {
              passgen(newPassword).hash(sails.config.session.secret, function(err, hashedPassword) {
                if (err) return done(err);
                hashedPassword.should.equal(result.rows[0].password);
                done();
              });
            })
            .catch(function(err) {
              done(err);
            });
        })
        .catch(function(err) {
          done(err);
        });

    });

    it('should update password and should not refresh access token', function(done) {

      var newPassword = 'qwerasdf';
      UserService.updatePassword(user.id, newPassword, false)
        .then(function(updatedUser) {
          updatedUser.accessToken.should.equal(accessToken);

          DBService.select('users', '*', [
              { field: 'id = $', value: user.id }
            ])
            .then(function(result) {
              passgen(newPassword).hash(sails.config.session.secret, function(err, hashedPassword) {
                if (err) return done(err);
                hashedPassword.should.equal(result.rows[0].password);
                done();
              });
            })
            .catch(function(err) {
              done(err);
            });
        })
        .catch(function(err) {
          done(err);
        });

    });

  });

});