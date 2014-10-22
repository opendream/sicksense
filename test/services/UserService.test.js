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

  describe('verify()', function () {

    var data = {};

    before(function (done) {

      // create new user
      DBService
      .insert('users', [
        { field: 'email', value: 'randomedtotestverify001@sicksense.org' },
        { field: 'password', value: 'text-here-is-ignored' }
      ])
      .then(function (result) {
        data.user = result.rows[0];
        // assign verification token
        return OnetimeTokenService.create('test', data.user.id, 10)
          .then(function (tokenObject) {
            data.tokenObject = tokenObject;
          });
      })
      // create sicksense id
      .then(function () {
        return DBService.insert('sicksense', [
          { field: 'email', value: 'verifyemailtest001@opendream.co.th' },
          { field: 'password', value: 'password-here-is-ignored' },
          { field: '"createdAt"', value: new Date() }
        ]);
      })
      .then(function (result) {
        data.sicksense = result.rows[0];
        return DBService.insert('sicksense_users', [
          { field: 'sicksense_id', value: data.sicksense.id },
          { field: 'user_id', value: data.user.id }
        ]);
      })
      .then(function () {
        done();
      })
      .catch(done);

    });

    it('should mark user as verified', function (done) {

      UserService.verify(data.user.id)
        .then(function () {

          DBService.select('sicksense', 'is_verify', [
            { field: 'id = $', value: data.sicksense.id }
          ])
          .then(function (result) {
            result.rows.should.have.length(1);
            result.rows[0].is_verify.should.equal(true);
            done();
          })
          .catch(done);

        });

    });

  });

  describe('doesSicksenseIDExist(:email)', function () {

    var data = {};

    before(function (done) {

      // create new user
      DBService
      .insert('users', [
        { field: 'email', value: 'doesSicksenseIDExist001@sicksense.org' },
        { field: 'password', value: 'text-here-is-ignored' }
      ])
      .then(function (result) {
        data.user = result.rows[0];
        // assign verification token
        return OnetimeTokenService.create('test', data.user.id, 10)
          .then(function (tokenObject) {
            data.tokenObject = tokenObject;
          });
      })
      // create sicksense id
      .then(function () {
        return DBService.insert('sicksense', [
          { field: 'email', value: 'doesSicksenseIDExist001@opendream.co.th' },
          { field: 'password', value: 'password-here-is-ignored' },
          { field: '"createdAt"', value: new Date() }
        ]);
      })
      .then(function (result) {
        data.sicksense = result.rows[0];
        return DBService.insert('sicksense_users', [
          { field: 'sicksense_id', value: data.sicksense.id },
          { field: 'user_id', value: data.user.id }
        ]);
      })
      .then(function () {
        done();
      })
      .catch(done);

    });

    it('should resolve sicksense object if exists', function (done) {
      UserService.doesSicksenseIDExist('doesSicksenseIDExist001@opendream.co.th')
        .then(function (result) {
          result.id.should.exists;
          result.email.should.equal('doesSicksenseIDExist001@opendream.co.th');
          done();
        });
    });

    it('should resolve false if else', function (done) {
      UserService.doesSicksenseIDExist('no-no-no-i-am-none@opendream.co.th')
        .then(function (result) {
          result.should.equal(false);
          done();
        });
    });

  });

});
