var pg = require('pg');
pg.defaults.application_name = 'sicksense_test';
var request = require('supertest');
var when = require('when');
var rewire = require('rewire');
var passgen = require('password-hash-and-salt');

describe('UserController test', function() {

  before(function(done) {
    MailService.subscribe = when.resolve;
    MailService.send = when.resolve;
    done();
  });

  after(function(done) {
    TestHelper.clearAll()
      .then(done, done);
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

    describe('e-mail verification', function () {

      var mailserviceSend,
          onetimetokenserviceCreate,
          counter = {
            mail: 0,
            onetimetoken: 0
          },
          mail = {};

      beforeEach(function (done) {
        mailserviceSend = sails.services.mailservice.send;
        onetimetokenserviceCreate = sails.services.onetimetokenservice.create;

        sails.services.mailservice.send = function send(subject, body, from, to, html) {
          counter.mail++;
          mail.body = body;
          mail.to = to;
          mail.html = html;
        };

        sails.services.onetimetokenservice.create = function send() {
          counter.onetimetoken++;
          return onetimetokenserviceCreate.apply(this, arguments);
        };

        done();
      });

      afterEach(function (done) {
        counter.mail = 0;
        counter.onetimetoken = 0;
        mail = {};

        sails.services.mailservice.send = mailserviceSend;
        sails.services.onetimetokenservice.create = onetimetokenserviceCreate;
        done();
      });

      it('should save new record and do not send e-mail if user is an unsubscribed account', function(done) {
        request(sails.hooks.http.app)
          .post('/users')
          .send({
            email: "siriwat6@sicksense.org",
            password: "12345678"
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);
            counter.onetimetoken.should.equal(0);
            counter.mail.should.equal(0);
            done();
          });
      });

      it('should save new record and send e-mail if user is a subscribed account', function(done) {
        var mailConfig = sails.config.mail.verificationEmail;
        // Override.
        sails.config.mail.verificationEmail = {
          subject: '[sicksense] Please verify your e-mail',
          body: 'Use this link %token%',
          from: 'sicksense.org',
          html: 'Use this link %token%',
          lifetime: (60 * 60) * 3000 // 3 hours
        };

        request(sails.hooks.http.app)
          .post('/users')
          .send({
            // we use e-mail to check if a subscribed one or not.
            email: "siriwat600@opendream.co.th",
            password: "12345678"
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);

            // delay here because aync mail sent.
            setTimeout(function () {
              counter.onetimetoken.should.equal(1);
              counter.mail.should.equal(1);

              // vefify that token send to correct e-mail
              DBService.select('onetimetoken', 'token', [
                { field: 'user_id = $', value: res.body.response.id },
              ]).then(function (result) {
                var token = result.rows[0].token;

                mail.body.should.containEql(token);
                mail.to.should.equal("siriwat600@opendream.co.th");
                mail.html.should.containEql(token);

                // revert to default value.
                sails.config.mail.verificationEmail = mailConfig;

                done();
              });
            }, 10);
          });
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

  });

  describe('[POST] /user/:id', function() {

    var user;
    before(function(done) {
      TestHelper.clearAll()
        .then(function () {
          return TestHelper.createUser({ email: "siriwat-before-real@opendream.co.th", password: "12345678" }, true);
        })
        .then(function() {
          return TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" }, true);
        })
        .then(function(_user) {
          user = _user;
          done();
        })
        .catch(done);
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

    it('should add user subscribe', function (done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id)
        .query({
          accessToken: user.accessToken
        })
        .send({
          subscribe: true
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(new Error(err));

          res.body.response.isSubscribed.should.be.true;

          pgconnect(function(err, client, pgDone) {
            if (err) return res.serverError('Could not connect to database.');

            EmailSubscriptionsService.isSubscribed(client, res.body.response).then(function (isSubscribed) {
              isSubscribed.should.be.true;
              pgDone();

              done();
            }).catch(function (err) {
              pgDone();

              done(err);
            });
          });

        });
    });

    it('should add user unsubscribe', function (done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id)
        .query({
          accessToken: user.accessToken
        })
        .send({
          subscribe: false
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(new Error(err));

          res.body.response.isSubscribed.should.be.false;

          pgconnect(function(err, client, pgDone) {
            if (err) return res.serverError('Could not connect to database.');

            EmailSubscriptionsService.isSubscribed(client, res.body.response).then(function (isSubscribed) {
              isSubscribed.should.be.false;
              pgDone();

              done();
            }).catch(function (err) {
              pgDone();

              done(err);
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

    it('should return user is subscribed', function (done) {
      request(sails.hooks.http.app)
        .get('/users/' + user.id)
        .query({
          accessToken: user.accessToken
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.isSubscribed.should.be.false;

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

  describe('[POST] /users/forgot-password', function() {
    var user, token, mailserviceSend;

    before(function(done) {
      mailserviceSend = MailService.send;
      MailService.send = when.resolve;
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
      MailService.send = mailserviceSend;
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should error when email is not provided', function(done) {
      request(sails.hooks.http.app)
        .post('/users/forgot-password')
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when email is provided but it does not exists', function(done) {
      request(sails.hooks.http.app)
        .post('/users/forgot-password')
        .send({ email: 'adam@example.com' })
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should create new token', function(done) {
      request(sails.hooks.http.app)
        .post('/users/forgot-password')
        .send({ email: 'john@example.com' })
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
                result.rows[0].type.should.equal('user.resetPassword');
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
        .post('/users/forgot-password')
        .send({ email: 'john@example.com' })
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

  describe('[POST] /users/reset-password', function() {
    var user, token, mailserviceSend;
    var mockTokens = [
      {
        token: '12345678',
        type: 'testdelete',
        expired: new Date()
      },
      {
        token: '23456789',
        type: 'testdelete',
        expired: new Date()
      }
    ];

    before(function(done) {
      mailserviceSend = MailService.send;
      MailService.send = when.resolve;

      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createUser({ email: "john@example.com", password: "12345678" }, false);
        })
        .then(function(_user) {
          user = _user;
        })
        .then(function() {
          return when.map(mockTokens, function(token) {
            return DBService.insert('onetimetoken', [
              { field: 'user_id', value: user.id },
              { field: 'token', value: token.token },
              { field: 'type', value: token.type },
              { field: 'expired', value: token.expired }
            ]);
          });
        })
        .then(function() {
          done();
        })
        .catch(done);
    });

    after(function(done) {
      MailService.send = mailserviceSend;

      TestHelper.clearAll()
        .then(done, done);
    });

    it('should error when nothing is provided', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when token is provided but password', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .send({ token: '12345678' })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when token and password are provided but password is empty', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .send({ token: '12345678', password: '' })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when token and password are provided but token is empty', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .send({ token: '', password: '12345678' })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should error when token and password are provided but token is invalid', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .send({ token: 'invalidtoken', password: '12345678' })
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should update password, clear token, and return user object with accessToken', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .send({ token: '12345678', password: 'new-password' })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          DBService.select('users', 'password', [
              { field: 'email = $', value : user.email }
            ])
            .then(function(result) {
              passgen('new-password').hash(sails.config.session.secret, function(err, hashedPassword) {
                result.rows[0].password.should.equal(hashedPassword);

                DBService.select('onetimetoken', '*', [
                    { field: 'user_id = $', value: user.id },
                    { field: 'type = $', value: 'user.resetPassword' }
                  ])
                .then(function(result) {
                  result.rows.length.should.equal(0);
                })
                .then(function() {
                  res.body.response.user.should.be.ok;
                  res.body.response.user.id.should.equal(user.id);
                  (res.body.response.user.password === undefined).should.be.true;
                  res.body.response.user.accessToken.should.be.ok;

                  AccessToken.findOneByUserId(user.id).exec(function(err, result) {
                    result.should.be.ok;
                    done();
                  });
                })
                .catch(done);
              })
            })
            .catch(done);

        });
    });
  });

  describe('[POST] /users/verify : Verify e-mail test', function () {

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

    it('should require `token` field', function (done) {
      request(sails.hooks.http.app)
        .post('/users/verify')
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");
          res.body.meta.errorMessage.should.match(/is required/);

          done();
        });
    });

    it('should return 403 if token does not exist', function (done) {
      request(sails.hooks.http.app)
        .post('/users/verify')
        .query({ token: 'thisisnotthevalidtoken' })
        .expect(403)
        .end(function (err, res) {
          if (err) return done(err);
          done();
        });
    });

    it('should return 403 if token does not valid or expired', function (done) {

      DBService.update('onetimetoken', [
        { field: 'expired = $', value: (new Date()).toJSON() },
      ], [
        { field: 'id = $', value: data.tokenObject.id }
      ])
      .then(function () {
        request(sails.hooks.http.app)
          .post('/users/verify')
          .query({ token: data.tokenObject.token })
          .expect(403)
          .end(function (err, res) {
            if (err) return done(err);
            done();
          });
      });

    });

    it('should return 200 and mark user as verified if token is valid and then remove that token', function (done) {

      DBService.update('onetimetoken', [
        { field: 'expired = $', value: ( new Date( (new Date()).getTime() + 60000 ) ).toJSON() },
      ], [
        { field: 'id = $', value: data.tokenObject.id }
      ])
      .then(function () {
        request(sails.hooks.http.app)
          .post('/users/verify')
          .send({ token: data.tokenObject.token })
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);
            console.log('--', res.body);

            res.body.response.id.should.exist;
            res.body.response.accessToken.should.exist;

            // Should mark user as verified.
            DBService.select('sicksense', 'is_verify', [
              { field: 'id = $', value: data.sicksense.id }
            ])
            .then(function (result) {
              result.rows[0].is_verify.should.equal(true);

              DBService.select('onetimetoken', 'id', [
                { field: 'id = $', value: data.tokenObject.id }
              ])
              .then(function (result) {
                result.rows.should.have.length(0);
                done();
              })
              .catch(done);
            })
            .catch(done);
          });
      });

    });
  });

});
