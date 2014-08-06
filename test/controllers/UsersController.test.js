var pg = require('pg');
var request = require('supertest');
var when = require('when');

describe('UserController test', function() {

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

    it('should validate parameters', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");
          res.body.meta.errorMessage.should.match(/is required/);

          res.body.meta.invalidFields.should.have.properties([
            'email', 'password', 'gender', 'birthYear',
            'address.subdistrict', 'address.district', 'address.city'
          ]);

          res.body.meta.invalidFields.should.not.have.properties('tel');

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
            subdistrict: "Samsen-Nok",
            district: "Huay Kwang",
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
          res.body.response.address.subdistrict.should.equal("Samsen-Nok");
          res.body.response.address.district.should.equal("Huay Kwang");
          res.body.response.address.city.should.equal("Bangkok");
          res.body.response.location.latitude.should.equal(13.1135);
          res.body.response.location.longitude.should.equal(105.0014);
          res.body.response.accessToken.should.be.ok;
          res.body.response.platform.should.equal('doctormeios');

          // Keep in variable so it can later user.
          user = res.body.response;

          // Also verify that password is encrypted.
          pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
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
            subdistrict: "Samsen-Nok",
            district: "Huay Kwang",
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
            subdistrict: "Samsen-Nok",
            district: "Huay Kwang",
            city: "Bangkok"
          },
          subscribe: true
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
            if (err) return done(new Error(err));

            var userId = res.body.response.id;
            client.query("SELECT * FROM email_subscription WHERE \"userId\" = $1", [ userId ], function(err, result) {
              pgDone();
              if (err) return done(new Error(err));

              result.rowCount.should.equal(1);
              result.rows[0].userId.should.equal(userId.toString());
              result.rows[0].token.should.not.empty;
              result.rows[0].notifyTime.should.equal('8:00');
              result.rows[0].createdAt.should.be.ok;
              result.rows[0].updatedAt.should.be.ok;
              done();
            });
          });
        });
    });

    it('should set default platform to `doctormeios`', function (done) {
      pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
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
            subdistrict: "Samsen-Nok",
            district: "Huay Kwang",
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

});
