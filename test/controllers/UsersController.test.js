var pg = require('pg');
pg.defaults.application_name = 'sicksense_test';
var request = require('supertest');
var when = require('when');

describe('UserController test', function() {

  before(function(done) {
    MailService.subscribe = when.resolve;
    done();
  });

  describe('[POST] /users', function() {
    var user;

    before(function(done) {
      TestHelper.clearUsers()
        .then(TestHelper.clearAccessTokens)
        .then(function() {
          done();
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

    it('should not require parameters except email and password', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");
          res.body.meta.errorMessage.should.match(/is required/);

          res.body.meta.invalidFields.should.have.properties([ 'email', 'password' ]);

          res.body.meta.invalidFields.should.not.have.properties([
            'gender', 'birthYear', 'address',
            'address.subdistrict', 'address.district', 'address.city'
          ]);

          done();
        });
    });

    it('should validate user address', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat-not-real@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Tak",
            district: "Huay Kwang",
            city: "Bangkok"
          },
          location: {
            latitude: 13.1135,
            longitude: 105.0014
          }
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.should.have.properties([ 'address' ]);

          done();
        });
    });

    it('should save new record with minimum fields requirement', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat-before-real@opendream.co.th",
          password: "12345678"
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should save new record', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          },
          location: {
            latitude: 13.1135,
            longitude: 105.0014
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(200);
          res.body.response.should.not.have.property('password');
          res.body.response.id.should.ok;
          res.body.response.email.should.equal("siriwat@opendream.co.th");
          res.body.response.tel.should.equal("0841291342");
          res.body.response.gender.should.equal("male");
          res.body.response.birthYear.should.equal(1986);
          res.body.response.address.subdistrict.should.equal("Samsen Nok");
          res.body.response.address.district.should.equal("Huai Khwang");
          res.body.response.address.city.should.equal("Bangkok");
          res.body.response.location.latitude.should.equal(13.1135);
          res.body.response.location.longitude.should.equal(105.0014);
          res.body.response.accessToken.should.be.ok;
          res.body.response.platform.should.equal('doctormeios');

          // Keep in variable so it can later user.
          user = res.body.response;

          // Also verify that password is encrypted.
          pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
            client.query(
              "SELECT password FROM users WHERE id=$1",
              [ res.body.response.id ],
              function(err, result) {
                pgDone();
                if (err) return done(err);

                result.rows[0].password.should.not.equal("12345678");

                // AccessToken must not expired.
                AccessToken.findOneByToken(res.body.response.accessToken).exec(function(err, accessToken) {
                  if (err) return done(err);
                  accessToken.expired.should.be.ok;
                  accessToken.expired.getTime().should.greaterThan((new Date()).getTime());

                  done();
                });
              }
            );
          });
        });
    });

    it('should save new record without location', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat1@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          }
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          done();
        });
    });

    it('should save new record with empty location', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat3@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          },
          location: {}
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          done();
        });
    });

    it('should save new record with empty address', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat4@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {}
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          done();
        });
    });

    it('should save new record with empty address and location', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat5@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {},
          location: {}
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          done();
        });
    });

    it('should subscribe if subscribe is sent', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat2@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          },
          subscribe: true
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
            if (err) return done(new Error(err));

            var userId = res.body.response.id;
            client.query("SELECT * FROM email_subscription WHERE \"userId\" = $1", [ userId ], function(err, result) {
              pgDone();
              if (err) return done(new Error(err));

              result.rowCount.should.equal(1);
              result.rows[0].userId.should.equal(userId);
              result.rows[0].notifyTime.substr(0, 8).should.equal('08:00:00');
              result.rows[0].createdAt.should.be.ok;
              result.rows[0].updatedAt.should.be.ok;
              done();
            });
          });
        });
    });

    it('should set default platform to `doctormeios`', function (done) {
      pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
        if (err) return done(new Error(err));

        client.query("SELECT platform FROM users WHERE id = $1", [ user.id ], function (err, result) {
          pgDone();
          if (err) return done(new Error(err));

          result.rows[0].platform.should.equal('doctormeios');
          done();
        });
      });
    });

    it('should not allow to create with existing email', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "siriwat@opendream.co.th",
          password: "12345678",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          },
          location: {
            latitude: 13.1135,
            longitude: 105.0014
          }
        })
        .expect('Content-Type', /json/)
        .expect(409)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(409);
          res.body.meta.errorType.should.equal('Conflict');
          res.body.meta.errorMessage.should.match(/is already (registered|existed)/);

          done();
        });
    });

    describe('[POST] /user/:id', function() {

      it('should require accessToken to save existing user', function(done) {
        request(sails.hooks.http.app)
          .post('/users/' + user.id)
          .expect(403)
          .end(function(err, res) {
            if (err) return done(new Error(err));
            done();
          });
      });

      it('should validate user address', function(done) {
        request(sails.hooks.http.app)
          .post('/users/' + user.id)
          .query({
            accessToken: user.accessToken
          })
          .send({
            email: "siriwat-not-real@opendream.co.th",
            password: "12345678",
            tel: "0841291342",
            gender: "male",
            birthYear: 1986,
            address: {
              subdistrict: "Tak",
              district: "Huay Kwang",
              city: "Bangkok"
            },
            location: {
              latitude: 13.1135,
              longitude: 105.0014
            }
          })
          .expect(400)
          .end(function(err, res) {
            if (err) return done(err);

            res.body.meta.invalidFields.should.have.properties([ 'address' ]);

            done();
          });
      });

      it('should save existing user record if provide userId', function(done) {
        request(sails.hooks.http.app)
          .post('/users/' + user.id)
          .query({
            accessToken: user.accessToken
          })
          .send({
            gender: "female",
            birthYear: 1990,
            address: {
              subdistrict: "Suan Luang",
              district: "Amphoe Krathum Baen",
              city: "Samut Sakhon"
            },
            platform: 'doctormeandroid'
          })
          .expect(200)
          .end(function(err, res) {
            if (err) return done(new Error(err));

            res.body.meta.status.should.equal(200);
            res.body.response.id.should.be.ok;
            res.body.response.gender.should.equal('female');
            res.body.response.birthYear.should.equal(1990);
            res.body.response.address.subdistrict.should.equal('Suan Luang');
            res.body.response.address.district.should.equal('Amphoe Krathum Baen');
            res.body.response.address.city.should.equal('Samut Sakhon');
            res.body.response.platform.should.equal('doctormeandroid');

            done();
          });
      });

      it('should allow update only e-mail', function(done) {
        request(sails.hooks.http.app)
          .post('/users/' + user.id)
          .query({
            accessToken: user.accessToken
          })
          .send({
            email: "siriwat+updated-email@opendream.co.th"
          })
          .expect(200)
          .end(function(err, res) {
            if (err) return done(new Error(err));

            res.body.meta.status.should.equal(200);
            res.body.response.id.should.equal(user.id);
            res.body.response.email.should.equal("siriwat+updated-email@opendream.co.th");
            res.body.response.gender.should.equal('female');
            res.body.response.birthYear.should.equal(1990);
            res.body.response.address.subdistrict.should.equal('Suan Luang');
            res.body.response.address.district.should.equal('Amphoe Krathum Baen');
            res.body.response.address.city.should.equal('Samut Sakhon');
            res.body.response.platform.should.equal('doctormeandroid');

            done();
          });
      });

      it('should not allow change to existing e-mail', function(done) {
        request(sails.hooks.http.app)
          .post('/users/' + user.id)
          .query({
            accessToken: user.accessToken
          })
          .send({
            // allow update to own e-mail
            email: "siriwat+updated-email@opendream.co.th"
          })
          .expect(200)
          .end(function(err, res) {
            if (err) return done(new Error(err));

            request(sails.hooks.http.app)
              .post('/users/' + user.id)
              .query({
                accessToken: user.accessToken
              })
              .send({
                email: "siriwat-before-real@opendream.co.th"
              })
              .expect(409)
              .end(function(err, res) {
                if (err) return done(new Error(err));

                res.body.meta.status.should.equal(409);
                res.body.meta.errorType.should.equal('Conflict');
                res.body.meta.errorMessage.should.match(/is already (registered|existed)/);

                done();
              });
          });
      });

      it('should allow user to update password', function(done) {
        request(sails.hooks.http.app)
          .post('/users/' + user.id)
          .query({
            accessToken: user.accessToken
          })
          .send({
            password: "1qaz2wsx"
          })
          .expect(200)
          .end(function(err, res) {
            if (err) return done(new Error(err));

            request(sails.hooks.http.app)
              .post('/login')
              .send({
                email: "siriwat+updated-email@opendream.co.th",
                password: "1qaz2wsx"
              })
              .expect(200)
              .end(function (err, res) {
                if (err) return done(new Error(err));

                res.body.meta.status.should.equal(200);
                res.body.response.id.should.equal(user.id);
                res.body.response.email.should.equal("siriwat+updated-email@opendream.co.th");
                res.body.response.gender.should.equal('female');
                res.body.response.birthYear.should.equal(1990);
                res.body.response.address.subdistrict.should.equal('Suan Luang');
                res.body.response.address.district.should.equal('Amphoe Krathum Baen');
                res.body.response.address.city.should.equal('Samut Sakhon');
                res.body.response.platform.should.equal('doctormeandroid');

                done();
              });
          });
      });
    });

  });

  describe('[GET] /users/:id', function() {
    var user, accessToken;

    before(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" }, true);
        })
        .then(function(_user) {
          user = _user;
          accessToken = user.accessToken;
          done();
        })
        .catch(done);
    });

    after(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should require accessToken', function(done) {
      request(sails.hooks.http.app)
        .get('/users/' + user.id)
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should return user', function(done) {
      request(sails.hooks.http.app)
        .get('/users/' + user.id)
        .query({
          accessToken: user.accessToken
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.id.should.equal(user.id);

          done();
        });
    });

  });

  describe('[GET] /users/:id/reports', function() {
    var user, accessToken, anotherAccessToken;

    before(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" }, true);
        })
        .then(function(_user) {
          user = _user;
          accessToken = user.accessToken;
        })
        .then(function() {
          return TestHelper.createUser({ email: "siriwat+faker@opendream.co.th", password: "12345678" }, true);
        })
        .then(function(anotherUser) {
          anotherAccessToken = anotherUser.accessToken;
          done();
        })
        .catch(done);
    });

    after(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should require accessToken', function(done) {
      request(sails.hooks.http.app)
        .get('/users/' + user.id + '/reports')
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should check only owner can get own reports history', function(done) {
      request(sails.hooks.http.app)
        .get('/users/' + user.id + '/reports')
        .query({ accessToken: anotherAccessToken })
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should return user\'s reports with respect offset and limit', function(done) {
      var reports = [];

      doMockReports().then(function() {
        request(sails.hooks.http.app)
          .get('/users/' + user.id + '/reports')
          .query({ accessToken: accessToken, offset: 1, limit: 1 })
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);

            res.body.response.reports.should.be.ok;
            res.body.response.reports.count.should.equal(4);
            res.body.response.reports.items.should.be.Array;
            res.body.response.reports.items.length.should.equal(1);

            var _reports = res.body.response.reports.items;

            _reports[0].should.have.properties([ 'id', 'isFine', 'startedAt', 'location' ]);
            _reports[0].id.should.equal(reports[2].id);
            // Must hide privacy data.
            _reports[0].should.not.have.properties([ 'userId' ]);

            done();
          });
      });

      function doMockReports() {
        return TestHelper.createReport({ userId: user.id })
          .then(function(report) {
            reports.push(report);
            return TestHelper.createReport({ userId: user.id });
          })
          .then(function(report) {
            reports.push(report);
            return TestHelper.createReport({ userId: user.id });
          })
          .then(function(report) {
            reports.push(report);
            return TestHelper.createReport({ userId: user.id });
          })
          .then(function(report) {
            reports.push(report);
          });
      }

    });

  });

  describe('[POST] /users/forgotpassword', function() {
    var user, token;

    before(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createUser({ email: "john@example.com", password: "12345678" }, true);
        })
        .then(function(_user) {
          user = _user;
          done();
        })
        .catch(done);
    });

    after(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should error when email is not provided', function(done) {
      request(sails.hooks.http.app)
        .post('/users/forgotpassword')
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when email is provided but it does not exists', function(done) {
      request(sails.hooks.http.app)
        .post('/users/forgotpassword')
        .query({ email: 'adam@example.com' })
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should create new token', function(done) {
      request(sails.hooks.http.app)
        .post('/users/forgotpassword')
        .query({ email: 'john@example.com' })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
            client.query(
              "SELECT * FROM onetimetoken WHERE user_id=$1 ORDER BY id DESC",
              [ user.id ],
              function(err, result) {
                pgDone();
                if (err) return done(err);

                result.rows.length.should.equal(1);
                result.rows[0].token.length.should.greaterThan(0);
                result.rows[0].type.should.equal('user.forgotpassword');
                result.rows[0].expired.should.greaterThan(new Date());

                token = result.rows[0];
                done();
              }
            );
          });
        });
    });

    it('should remove old token before create the new one', function(done) {
      request(sails.hooks.http.app)
        .post('/users/forgotpassword')
        .query({ email: 'john@example.com' })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
            client.query(
              "SELECT * FROM onetimetoken WHERE user_id=$1 ORDER BY id DESC",
              [ user.id ],
              function(err, result) {
                pgDone();
                if (err) return done(err);

                sails.log.debug(result.rows);

                result.rows.length.should.equal(1);
                result.rows[0].token.should.not.equal(token.token);
                result.rows[0].expired.should.greaterThan(token.expired);

                done();
              }
            );
          });
        });
    });

  });

});
