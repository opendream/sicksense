var when = require('when');
var passgen = require('password-hash-and-salt');

describe('UserService test', function() {

  describe('updatePassword()', function() {
    var data = {};

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createSicksenseID({ email: "siriwat@opendream.co.th", password: "12345678" });
        })
        .then(function(_sicksenseID) {
          data.sicksenseID = _sicksenseID;
        })
        .then(function() {
          return TestHelper.createUser({ email: "A001@sicksense.org", password: "A001" }, true);
        })
        .then(function (_user) {
          data.user = _user;
        })
        .then(function () {
          return TestHelper.createUser({ email: "A002@sicksense.org", password: "A002" }, true);
        })
        .then(function (_user) {
          data.user2 = _user;
        })
        .then(function () {
          return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user);
        })
        .then(function () {
          return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user2);
        })
        .then(function() {
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

    it('should update password and clear all access token', function(done) {

      var newPassword = 'qwerasdf';
      UserService.updatePassword(data.sicksenseID.id, newPassword, true)

        // Check password.
        .then(function() {
          DBService.select('sicksense', '*', [
              { field: 'id = $', value: data.sicksenseID.id }
            ])
            .then(function(result) {
              passgen(newPassword).hash(sails.config.session.secret, function(err, hashedPassword) {
                if (err) return done(err);
                hashedPassword.should.equal(result.rows[0].password);
              });
            })
            .catch(function(err) {
              done(err);
            });
        })

        // Check user's access tokens.
        .then(function () {
          DBService.select('accesstoken', '*', [
              { field: '"userId" = $', value: data.user.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(0);
            })
            .catch(function (err) {
              done(err);
            });
        })
        .then(function () {
          DBService.select('accesstoken', '*', [
              { field: '"userId" = $', value: data.user2.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(0);
            })
            .catch(function (err) {
              done(err);
            });
        })
        .then(function () {
          done();
        })
        .catch(function(err) {
          done(err);
        });

    });

    it('should update password and should not refresh access token', function(done) {

      var newPassword = 'qwerasdf';
      UserService.updatePassword(data.sicksenseID.id, newPassword, false)
        .then(function() {

          // Check password.
          DBService.select('sicksense', '*', [
              { field: 'id = $', value: data.sicksenseID.id }
            ])
            .then(function(result) {
              passgen(newPassword).hash(sails.config.session.secret, function(err, hashedPassword) {
                if (err) return done(err);
                hashedPassword.should.equal(result.rows[0].password);
              });
            })
            .catch(function(err) {
              done(err);
            });
        })
        .then(function () {
          DBService.select('accesstoken', '*', [
              { field: '"userId" = $', value: data.user.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(1);
              result.rows[0].token.should.equal(data.user.accessToken);
            })
            .catch(function (err) {
              done(err);
            });
        })
        .then(function () {
          DBService.select('accesstoken', '*', [
              { field: '"userId" = $', value: data.user2.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(1);
              result.rows[0].token.should.equal(data.user2.accessToken);
              done();
            })
            .catch(function (err) {
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
      TestHelper.createSicksenseID({
        email: 'verifyemailtest001@opendream.co.th',
        password: 'password-here-is-ignored'
      })
      .then(function (sicksenseID) {
        data.sicksenseID = sicksenseID;
      })
      .then(function () {
        return TestHelper.createUser({
          emai: 'randomedtotestverify001@sicksense.org',
          password: 'password-here-is-ignored'
        }, true);
      })
      .then(function (user) {
        data.user = user;
      })
      .then(function () {
        return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user);
      })
      .then(function () {
        return OnetimeTokenService.create('test', data.sicksenseID.id, 10);
      })
      .then(function (tokenObject) {
        data.tokenObject = tokenObject;
      })
      .then(function() {
        done();
      })
      .catch(function (err) {
        done(err);
      });

    });

    it('should mark user as verified', function (done) {

      UserService.verify(data.sicksenseID.id)
        .then(function () {

          DBService.select('sicksense', 'is_verify', [
            { field: 'id = $', value: data.sicksenseID.id }
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
        })
        .catch(function (err) {
          done(err);
        });
    });
  });

  describe('getUsersFromSicksenseID()', function () {
    var data = {};

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createSicksenseID({ email: "siriwat@opendream.co.th", password: "12345678" });
        })
        .then(function(_sicksenseID) {
          data.sicksenseID = _sicksenseID;
        })
        .then(function() {
          return TestHelper.createUser({ email: "A001@sicksense.org", password: "A001" }, true);
        })
        .then(function (_user) {
          data.user = _user;
        })
        .then(function () {
          return TestHelper.createUser({ email: "A002@sicksense.org", password: "A002" }, true);
        })
        .then(function (_user) {
          data.user2 = _user;
        })
        .then(function () {
          return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user);
        })
        .then(function () {
          return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user2);
        })
        .then(function() {
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

    it('should return 2 users', function (done) {

      UserService.getUsersBySicksenseId(data.sicksenseID.id)
        .then(function (users) {
          users.length.should.equal(2);
          users[0].id.should.be.ok;
          users[1].id.should.be.ok;
          done();
        })
        .catch(function (err) {
          done(err);
        });

    });

    it('should return 1 users', function (done) {

      DBService.delete('sicksense_users', [
          { field: 'user_id = $', value: data.user.id }
        ])
        .then(function () {
          return UserService.getUsersBySicksenseId(data.sicksenseID.id);
        })
        .then(function (users) {
          users.length.should.equal(1);
          users[0].id.should.be.ok;
          done();
        })
        .catch(function (err) {
          done(err);
        });

    });

    it('should return 0 users', function (done) {

      DBService.delete('sicksense_users', [
          { field: 'user_id = $', value: data.user.id }
        ])
        .then(function () {
          return DBService.delete('sicksense_users', [
            { field: 'user_id = $', value: data.user2.id }
          ])
        })
        .then(function () {
          return UserService.getUsersBySicksenseId(data.sicksenseID.id);
        })
        .then(function (users) {
          users.length.should.equal(0);
          done();
        })
        .catch(function (err) {
          done(err);
        });

    });

  });

  describe('getSicksenseIDByEmail()', function () {
    var data = {};

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createSicksenseID({ email: "siriwat@opendream.co.th", password: "12345678" });
        })
        .then(function(_sicksenseID) {
          data.sicksenseID = _sicksenseID;
        })
        .then(function() {
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

    it('should return sicksense id', function (done) {

      UserService.getSicksenseIDByEmail('siriwat@opendream.co.th')
        .then(function (sicksenseID) {
          sicksenseID.should.be.ok;
          sicksenseID.id.should.equal(data.sicksenseID.id);
          sicksenseID.email.should.equal('siriwat@opendream.co.th');
          (sicksenseID.password === undefined).should.be.true;
          done();
        })
        .catch(function (err) {
          done(err);
        });

    });

    it('should error if not found', function (done) {

      UserService.getSicksenseIDByEmail('siriwat2@opendream.co.th')
        .catch(function (err) {
          done();
        });

    });

  });

  describe('formattedUser()', function (){
    var data = {};

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createUser({
            email: 'A001@sicksense.org',
            password: 'A001'
          }, true);
        })
        .then(function (user) {
          data.user = user;
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });

    afterEach(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });


    it('should return formatted user', function (done) {
      var formatted = UserService.formattedUser(data.user);
      formatted.id.should.equal(data.user.id);
      formatted.email.should.equal(data.user.email);
      formatted.tel.should.equal(data.user.tel);
      formatted.location.latitude.should.equal(data.user.latitude);
      formatted.location.longitude.should.equal(data.user.longitude);
      formatted.address.subdistrict.should.equal(data.user.subdistrict);
      formatted.address.district.should.equal(data.user.district);
      formatted.address.city.should.equal(data.user.city);
      done();
    });

    it('should contains extra parameters', function (done) {
      var formatted = UserService.formattedUser(data.user, {
        accessToken: '1234',
        whatever: 'something',
        level1: {
          level2: 'yeah'
        }
      });
      formatted.accessToken.should.equal('1234');
      formatted.whatever.should.equal('something');
      formatted.level1.level2.should.equal('yeah');
      done();
    });

  });

  describe('getUserJSON()', function () {
    var data = {};

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createSicksenseID({
            email: "siriwat@opendream.co.th",
            password: "12345678"
          })
          .then(function(_sicksenseID) {
            data.sicksenseID = _sicksenseID;
            return TestHelper.createUser({
              email: 'A001@sicksense.org',
              password: 'A001'
            }, true);
          })
          .then(function (user) {
            data.user = user;
            return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user);
          })
          .catch(function (err) {
            done(err);
          });
        })
        .then(function () {
          return TestHelper.createUser({
            email: 'A002@sicksense.org',
            password: 'A002'
          })
          .then(function (user) {
            data.user2 = user;
          })
          .catch(function (err) {
            done(err);
          });
        })
        .then(function () {
          return TestHelper.createUser({
            email: 'A003@sicksense.org',
            password: 'A003'
          }, true)
          .then(function (user) {
            data.user3 = user;
          })
          .then(function () {
            return DBService.insert('devices', [
                { field: 'user_id', value: data.user3.id },
                { field: 'subscribe_pushnoti', value: false },
                { field: 'id', value: 'fake-device-token' },
                { field: '"createdAt"', value: new Date() },
                { field: '"updatedAt"', value: new Date() }
              ]);
          })
          .catch(function (err) {
            done(err);
          });
        })
        .then(function() {
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

    it('should contains sicksense email, access token, and demographic', function (done) {
      UserService.getUserJSON(data.user.id)
        .then(function (user) {
          user.id.should.equal(data.user.id);
          user.email.should.equal(data.sicksenseID.email);
          user.tel.should.equal(data.user.tel);
          user.location.latitude.should.equal(data.user.latitude);
          user.location.longitude.should.equal(data.user.longitude);
          user.address.subdistrict.should.equal(data.user.subdistrict);
          user.address.district.should.equal(data.user.district);
          user.address.city.should.equal(data.user.city);
          user.accessToken.should.equal(data.user.accessToken);
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });

    it('should contains uuid email, no access token', function (done) {
      UserService.getUserJSON(data.user2.id)
        .then(function (user) {
          user.id.should.equal(data.user2.id);
          user.email.should.equal(data.user2.email);
          user.tel.should.equal(data.user2.tel);
          user.location.latitude.should.equal(data.user2.latitude);
          user.location.longitude.should.equal(data.user2.longitude);
          user.address.subdistrict.should.equal(data.user2.subdistrict);
          user.address.district.should.equal(data.user2.district);
          user.address.city.should.equal(data.user2.city);
          (user.accessToken === undefined).should.be.true;
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });

    it('should contains device token', function (done) {
      UserService.getUserJSON(data.user3.id)
        .then(function (user) {
          user.id.should.equal(data.user3.id);
          user.deviceToken.should.equal('fake-device-token');
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });

  });

});
