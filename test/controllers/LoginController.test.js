var request = require('supertest');
var when = require('when');
var pg = require('pg');
var passgen = require('password-hash-and-salt');
pg.defaults.application_name = 'sicksense_test';

describe('LoginController test', function() {

  /*describe('[POST] login', function() {
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
  });*/

  describe('[POST] connect', function() {
    var data = {};

    beforeEach(function(done) {
      TestHelper.clearAll()
        // User, SicksenseID, Connected.
        .then(function() {
          return TestHelper.createSicksenseID({
            email: "siriwat@opendream.co.th",
            password: "12345678",
          })
          .then(function (sicksenseID) {
            data.sicksenseID = sicksenseID;
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
        // User, SicksenseID, Disconnected.
        .then(function() {
          return TestHelper.createSicksenseID({
            email: "siriwat2@opendream.co.th",
            password: "12345678",
          })
          .then(function (sicksenseID) {
            data.sicksenseID2 = sicksenseID;
            return TestHelper.createUser({
              email: 'A002@sicksense.org',
              password: 'A002'
            }, true);
          })
          .then(function (user) {
            data.user2 = user;
          })
          .catch(function (err) {
            done(err);
          });
        })
        // Only SicksenseID.
        .then(function () {
          return TestHelper.createSicksenseID({
            email: "siriwat3@opendream.co.th",
            password: "12345678",
          })
          .then(function (sicksenseID) {
            data.sicksenseID3 = sicksenseID;
          })
        })
        // Only User.
        .then(function () {
          return TestHelper.createUser({
            email: 'A004@sicksense.org',
            password: 'A004'
          }, true);
        })
        .then(function (user) {
          data.user4 = user;
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

    describe('validate parameters', function () {

      it('should error when nothing is sent', function (done) {
        request(sails.hooks.http.app)
          .post('/connect')
          .expect(400)
          .end(function (err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.should.have.properties('email', 'password', 'uuid');
            done();
          });
      });

      it('should error when only email is sent', function (done) {
        request(sails.hooks.http.app)
          .post('/connect')
          .send({ email: 'siriwat@opendream.co.th' })
          .expect(400)
          .end(function (err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.should.have.properties('password', 'uuid');
            res.body.meta.invalidFields.should.not.have.properties('email');
            done();
          });
      });

      it('should error when email and password are sent but uuid', function (done) {
        request(sails.hooks.http.app)
          .post('/connect')
          .send({ email: 'siriwat@opendream.co.th', password: '12345678' })
          .expect(400)
          .end(function (err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.should.have.properties('uuid');
            res.body.meta.invalidFields.should.not.have.properties('email', 'password');
            done();
          });
      });

      it('should error when email and password are not match', function (done) {
        request(sails.hooks.http.app)
          .post('/connect')
          .send({
            email: 'siriwat@opendream.co.th',
            password: '123456789',
            uuid: 'A002'
          })
          .expect(403)
          .end(function (err, res) {
            if (err) return done(err);
            done();
          });
      });

    });

    it('should return user object with accessToken if user and sicksense id are exists and they are already connected', function (done) {
      request(sails.hooks.http.app)
        .post('/connect')
        .query({ accessToken: data.user.accessToken })
        .send({
          email: data.sicksenseID.email,
          password: '12345678',
          uuid: 'A001'
        })
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.response.id.should.equal(data.user.id);
          res.body.response.email.should.equal(data.sicksenseID.email);
          res.body.response.accessToken.should.be.ok;
          done();
        });
    });

    it('should return user object with accessToken then user and sicksense id should be connected', function (done) {
      UserService.getUsersBySicksenseId(data.sicksenseID2.id)
        .then(function (users) {
          users.length.should.equal(0);
        })
        .then(function () {
          request(sails.hooks.http.app)
            .post('/connect')
            .query({ accessToken: data.user2.accessToken })
            .send({
              email: data.sicksenseID2.email,
              password: '12345678',
              uuid: 'A002'
            })
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              res.body.response.id.should.equal(data.user2.id);
              res.body.response.email.should.equal(data.sicksenseID2.email);
              res.body.response.accessToken.should.be.ok;

              UserService.getUsersBySicksenseId(data.sicksenseID2.id)
                .then(function (users) {
                  users.length.should.equal(1);
                  done();
                })
                .catch(function (err) {
                  done(err);
                });
            });
        })
        .catch(function (err) {
          done(err);
        });
    });

    it('should create new user and return user object with accessToken if sicksense id is exists', function (done) {
      UserService.getUsersBySicksenseId(data.sicksenseID3.id)
        .then(function (users) {
          users.length.should.equal(0);
        }).then(function () {
          request(sails.hooks.http.app)
            .post('/connect')
            .send({
              email: data.sicksenseID3.email,
              password: '12345678',
              uuid: 'A003'
            })
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              res.body.response.id.should.be.ok;
              res.body.response.id.should.not.equal(data.user.id);
              res.body.response.id.should.not.equal(data.user2.id);
              res.body.response.id.should.not.equal(data.user4.id);
              res.body.response.email.should.equal(data.sicksenseID3.email);
              res.body.response.accessToken.should.be.ok;

              UserService.getUsersBySicksenseId(data.sicksenseID3.id)
                .then(function (users) {
                  users.length.should.equal(1);
                  res.body.response.id.should.equal(users[0].id);
                  done();
                })
                .catch(function (err) {
                  done(err);
                });
            });
        })
        .catch(function (err) {
          done(err);
        });
    });

    it('should create new user by duplicate the latest one if sicksense id is exists', function (done) {
      request(sails.hooks.http.app)
        .post('/connect')
        .send({
          email: data.sicksenseID.email,
          password: '12345678',
          uuid: 'A003'
        })
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          res.body.response.id.should.be.ok;
          res.body.response.email.should.equal(data.sicksenseID.email);
          res.body.response.tel.should.equal(data.user.tel);
          res.body.response.gender.should.equal(data.user.gender);
          res.body.response.birthYear.should.equal(data.user.birthYear);
          res.body.response.address.subdistrict.should.equal(data.user.subdistrict);
          res.body.response.address.district.should.equal(data.user.district);
          res.body.response.address.city.should.equal(data.user.city);
          res.body.response.location.latitude.should.equal(data.user.latitude);
          res.body.response.location.longitude.should.equal(data.user.longitude);
          res.body.response.accessToken.should.be.ok;

          UserService.getUsersBySicksenseId(data.sicksenseID.id)
            .then(function (users) {
              users.length.should.equal(2);
              _.find(users, { id: res.body.response.id }).id.should.be.ok;
              done();
            })
            .catch(function (err) {
              done(err);
            });
        });
    });

    it('should create new sicksense id return user object with accessToken if sicksense id is not found but user is exists', function (done) {
      request(sails.hooks.http.app)
        .post('/connect')
        .query({ accessToken: data.user4.accessToken })
        .send({
          email: 'siriwat4@opendream.co.th',
          password: '1qa2ws3ed',
          uuid: 'A004'
        })
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          res.body.response.id.should.equal(data.user4.id);
          res.body.response.email.should.equal('siriwat4@opendream.co.th');
          res.body.response.accessToken.should.be.ok;

          DBService.select('sicksense_users', '*', [
              { field: 'user_id = $', value: data.user4.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(1);
              return result.rows[0];
            })
            .then(function (row) {
              return DBService.select('sicksense', '*', [
                  { field: 'id = $', value: row.sicksense_id }
                ]);
            })
            .then(function (result) {
              result.rows.length.should.equal(1);
              var sicksenseID = result.rows[0];

              sicksenseID.email.should.equal('siriwat4@opendream.co.th');

              passgen('1qa2ws3ed').hash(sails.config.session.secret, function (err, password) {
                if (err) return done(err);
                sicksenseID.password.should.equal(password);
                done();
              });
            })
            .catch(function (err) {
              done(err);
            });
        });
    });

  });

  describe('[POST] unlink', function() {
    var data = {};

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function () {
          return TestHelper.createSicksenseID({
            email: 'siriwat@opendream.co.th',
            password: '12345678'
          })
          .then(function (sicksenseID) {
            data.sicksenseID = sicksenseID;
            return TestHelper.createUser({
              email: 'A001@sicksense.org',
              password: 'A001'
            }, true);
          })
          .then(function (user) {
            data.user = user;
            return TestHelper.connectSicksenseAndUser(data.sicksenseID, data.user);
          });
        })
        .then(function () {
          return TestHelper.createUser({
            email: 'A002@sicksense.org',
            password: 'A002',
          }, true);
        })
        .then(function (user) {
          data.user2 = user;
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });

    afterEach(function (done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should require accessToken', function (done) {
      request(sails.hooks.http.app)
        .post('/unlink')
        .expect(403)
        .end(function (err, res) {
          if (err) return done(err);
          done();
        });
    });

  });

});
