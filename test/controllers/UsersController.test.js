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

    it('should not require parameters except email, password, and uuid', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");

          res.body.meta.invalidFields.should.have.properties([ 'email', 'password', 'uuid' ]);

          res.body.meta.invalidFields.should.not.have.properties([
            'gender', 'birthYear', 'address',
            'address.subdistrict', 'address.district', 'address.city'
          ]);

          done();
        });
    });

    it('should validate shorter password', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "UUID-SICKSENSE-TEST1@sicksense.com",
          password: "TEST1"
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");

          res.body.meta.invalidFields.should.have.properties([ 'password' ]);
          res.body.meta.invalidFields.password.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');

          done();
        });
    });

    it('should validate longer password', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "UUID-SICKSENSE-TEST1@sicksense.com",
          password: "UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST1-65"
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");

          res.body.meta.invalidFields.should.have.properties([ 'password' ]);
          res.body.meta.invalidFields.password.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');

          done();
        });
    });

    it('should validate user address', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "UUID-SICKSENSE-TEST1@sicksense.com",
          password: "UUID-SICKSENSE-TEST1",
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
          },
          uuid: 'UUID-SICKSENSE-TEST1'
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
          email: "UUID-SICKSENSE-TEST1@sicksense.com",
          password: "UUID-SICKSENSE-TEST1",
          uuid: 'UUID-SICKSENSE-TEST1'
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
          email: "UUID-SICKSENSE-TEST2@sicksense.com",
          password: "UUID-SICKSENSE-TEST2",
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
          },
          uuid: 'UUID-SICKSENSE-TEST2'
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(200);
          res.body.response.should.not.have.property('password');
          res.body.response.id.should.ok;
          res.body.response.email.should.equal("UUID-SICKSENSE-TEST2@sicksense.com");
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
          email: "UUID-SICKSENSE-TEST3@sicksense.com",
          password: "UUID-SICKSENSE-TEST3",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          },
          uuid: 'UUID-SICKSENSE-TEST3'
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
          email: "UUID-SICKSENSE-TEST4@sicksense.com",
          password: "UUID-SICKSENSE-TEST4",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          },
          location: {},
          uuid: 'UUID-SICKSENSE-TEST4'
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
          email: "UUID-SICKSENSE-TEST5@sicksense.com",
          password: "UUID-SICKSENSE-TEST5",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {},
          uuid: 'UUID-SICKSENSE-TEST5'
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
          email: "UUID-SICKSENSE-TEST6@sicksense.com",
          password: "UUID-SICKSENSE-TEST6",
          tel: "0841291342",
          gender: "male",
          birthYear: 1986,
          address: {},
          location: {},
          uuid: 'UUID-SICKSENSE-TEST6'
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

        sails.services.mailservice.send = function send(subject, text, from, to, html) {
          counter.mail++;
          mail.text = text;
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
            email: "UUID-SICKSENSE-TEST7@sicksense.com",
            password: "UUID-SICKSENSE-TEST7",
            uuid: 'UUID-SICKSENSE-TEST7'
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
        var mailConfig = sails.config.mail.verification;
        // Override.
        sails.config.mail.verification = {
          subject: '[sicksense] Please verify your e-mail',
          text: 'Use this link %verification_url%',
          from: 'sicksense.com',
          html: 'Use this link %verification_url%',
          lifetime: (60 * 60) * 3000 // 3 hours
        };

        request(sails.hooks.http.app)
          .post('/users')
          .send({
            // we use e-mail to check if a subscribed one or not.
            email: "siriwat600@opendream.co.th",
            password: "12345678",
            uuid: 'UUID-SICKSENSE-TEST8'
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);

            // delay here because aync mail sent.
            setTimeout(function () {
              counter.onetimetoken.should.equal(1);
              counter.mail.should.equal(1);

              DBService.select('sicksense_users', 'sicksense_id', [
                  { field: 'user_id = $', value: res.body.response.id }
                ])
                .then(function (result) {
                  result.rows.length.should.equal(1);
                  return DBService.select('onetimetoken', 'token', [
                      { field: 'user_id = $', value: result.rows[0].sicksense_id }
                    ]);
                })
                .then(function (result) {
                  result.rows.length.should.equal(1);
                  var token = result.rows[0].token;

                  mail.text.should.containEql(token);
                  mail.to.should.equal("siriwat600@opendream.co.th");
                  mail.html.should.containEql(token);

                  // revert to default value.
                  sails.config.mail.verification = mailConfig;

                  done();
                })
                .catch(function (err) {
                  done(err);
                });
            }, 10);
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

    it('should not allow to create with existing email (anonymous)', function(done) {
      request(sails.hooks.http.app)
        .post('/users')
        .send({
          email: "UUID-SICKSENSE-TEST1@sicksense.com",
          password: "UUID-SICKSENSE-TEST1",
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
          },
          uuid: 'UUID-SICKSENSE-TEST1'
        })
        .expect('Content-Type', /json/)
        .expect(409)
        .end(function(err, res) {
          if (err) return done(new Error(err));

          res.body.meta.status.should.equal(409);
          res.body.meta.errorType.should.equal('Conflict');

          done();
        });
    });

    describe('with sicksense account', function() {

      var data = {};

      it('should create sicksense account with minimum fields requirement', function(done) {
        request(sails.hooks.http.app)
          .post('/users')
          .send({
            email: "siriwat+sicksense@opendream.co.th",
            password: "12345678",
            uuid: 'UUID-SICKSENSE-TEST10'
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);

            res.body.response.should.not.have.property('password');
            res.body.response.id.should.ok;
            res.body.response.email.should.equal("siriwat+sicksense@opendream.co.th");
            res.body.response.accessToken.should.be.ok;

            data.user = res.body.response;

            done();
          });
      });

      it('should not allow to create with existing email with incorrect password (sicksense id)', function(done) {
        request(sails.hooks.http.app)
          .post('/users')
          .send({
            email: "siriwat+sicksense@opendream.co.th",
            password: "incorrect-password-here",
            uuid: 'UUID-SIRIWAT-TEST10'
          })
          .expect('Content-Type', /json/)
          .expect(409)
          .end(function(err, res) {
            if (err) return done(err);

            res.body.meta.errorType.should.equal('Conflict');

            done();
          });
      });

      it('should allow to create with new e-mail and old uuid, unlink old sicksense id', function (done) {
        request(sails.hooks.http.app)
          .post('/users')
          .send({
            email: "siriwat+sicksense-002@opendream.co.th",
            password: "1234qwer",
            uuid: 'UUID-SICKSENSE-TEST10'
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(new Error(err));

            data.user2 = res.body.response;

            res.body.response.id.should.equal(data.user.id);
            res.body.response.sicksenseId.should.exists;
            // not generate new token
            res.body.response.accessToken.should.equal(data.user.accessToken);

            DBService.select('sicksense_users', '*', [
              { field: 'sicksense_id = $', value: data.user.sicksenseId }
            ])
            .then(function (result) {
              // unlink old devices
              result.rows.should.have.length(0);
              done();
            })
            .catch(done);
          });
      });

      it('should not login if register with correct e-mail and password and not verified', function (done) {
        request(sails.hooks.http.app)
          .post('/users')
          .send({
            email: "siriwat+sicksense-002@opendream.co.th",
            password: "1234qwer",
            uuid: 'UUID-SICKSENSE-TEST10'
          })
          .expect('Content-Type', /json/)
          .expect(403)
          .end(function (err, res) {
            if (err) return done(new Error(err));

            res.body.meta.errorSubType.should.equal('unverified_email');

            done();
          });
      });

      it('should auto-login if register with correct e-mail and password and already verified', function (done) {

        verify().then(function () {
          request(sails.hooks.http.app)
            .post('/users')
            .send({
              email: "siriwat+sicksense-002@opendream.co.th",
              password: "1234qwer",
              uuid: 'UUID-SICKSENSE-TEST10'
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(new Error(err));

              res.body.response.id.should.equal(data.user2.id);
              res.body.response.sicksenseId.should.equal(data.user2.sicksenseId);

              done();
            });
        });

        function verify() {
          return DBService.update('sicksense', [
            { field: 'is_verify = $', value: 't' }
          ], [
            { field: 'id = $', value: data.user2.sicksenseId }
          ]);
        }
      });

      it('should subscribe if subscribe is sent', function(done) {
        request(sails.hooks.http.app)
          .post('/users')
          .send({
            email: "siriwat+sicksense2@opendream.co.th",
            password: "12345678",
            tel: "0841291342",
            gender: "male",
            birthYear: 1986,
            address: {
              subdistrict: "Samsen Nok",
              district: "Huai Khwang",
              city: "Bangkok"
            },
            subscribe: true,
            uuid: 'UUID-SICKSENSE-TEST11'
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err);

            var userId = res.body.response.id;
            var sicksenseId;
            DBService.select('sicksense_users', 'sicksense_id', [
                { field: 'user_id = $', value: userId }
              ])
              .then(function (result) {
                result.rows.length.should.equal(1);
                sicksenseId = result.rows[0].sicksense_id;
                return DBService.select('email_subscription', '*', [
                    { field: '"userId" = $', value: parseInt(sicksenseId) }
                  ]);
              })
              .then(function (result) {
                result.rows.length.should.equal(1);
                result.rows[0].userId.should.equal(sicksenseId);
                result.rows[0].notifyTime.substr(0, 8).should.equal('08:00:00');
                result.rows[0].createdAt.should.be.ok;
                result.rows[0].updatedAt.should.be.ok;
                done();
              })
              .catch(function (err) {
                done(err);
              });
          });
      });

      it('should save demographic into data column (sicksense id)', function(done) {
        request(sails.hooks.http.app)
          .post('/users')
          .send({
            email: "siriwat+sicksense3@opendream.co.th",
            password: "12345678",
            uuid: 'UUID-SIRIWAT-TEST12',
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

            DBService.select('sicksense', 'data', [
                { field: 'id = $', value: res.body.response.sicksenseId }
              ])
              .then(function (result) {
                var profile = result.rows[0].data;

                DBService.select('users', '*', [
                    { field: 'id = $', value: res.body.response.id }
                  ])
                  .then(function (result) {
                    var _user = result.rows[0];
                    _user.tel.should.equal(profile.tel);
                    _user.gender.should.equal(profile.gender);
                    _user.birthYear.should.equal(profile.birthYear);
                    _user.subdistrict.should.equal(profile.subdistrict);
                    _user.district.should.equal(profile.district);
                    _user.city.should.equal(profile.city);
                    _user.latitude.should.equal(profile.latitude);
                    _user.longitude.should.equal(profile.longitude);
                    _user.geom.should.equal(profile.geom);
                    done();
                  })
                  .catch(function (err) {
                    done(err);
                  })
              })
              .catch(function (err) {
                done(err);
              });
          });
      });

    });

  });

  describe('[POST] /user/:id', function() {

    var user, sicksenseID;
    before(function(done) {
      TestHelper.clearAll()
        .then(function () {
          return TestHelper.createUser({
            email: 'A001@sicksense.com',
            password: 'A001'
          }, true);
        })
        .then(function() {
          return TestHelper.createUser({
            email: 'A002@sicksense.com',
            password: 'A002'
          }, true);
        })
        .then(function(_user) {
          user = _user;
        })
        .then(function () {
          return TestHelper.createSicksenseID({
            email: 'siriwat@opendream.co.th',
            password: '12345678'
          });
        })
        .then(function (_sicksenseID) {
          sicksenseID = _sicksenseID;
        })
        .then(function () {
          return TestHelper.connectSicksenseAndUser(sicksenseID, user);
        })
        .then(function () {
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

    it('should update sicksense data column', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id)
        .query({
          accessToken: user.accessToken
        })
        .send({
          tel: '0909876543',
          gender: "male",
          birthYear: 1998,
          address: {
            subdistrict: "Samsen Nok",
            district: "Huai Khwang",
            city: "Bangkok"
          },
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(new Error(err));

          DBService.select('sicksense', 'data', [
             { field: 'id = $', value: sicksenseID.id }
            ])
            .then(function (result) {
              var profile = result.rows[0].data;

              DBService.select('users', '*', [
                  { field: 'id = $', value: user.id }
                ])
                .then(function (result) {
                  var _user = result.rows[0];
                  _user.tel.should.equal(profile.tel);
                  _user.gender.should.equal(profile.gender);
                  _user.birthYear.should.equal(profile.birthYear);
                  _user.subdistrict.should.equal(profile.subdistrict);
                  _user.district.should.equal(profile.district);
                  _user.city.should.equal(profile.city);
                  _user.latitude.should.equal(profile.latitude);
                  _user.longitude.should.equal(profile.longitude);
                  _user.geom.should.equal(profile.geom);
                  done();
                })
                .catch(function (err) {
                  done(err);
                });
            })
            .catch(function (err) {
              done(err);
            });
        });
    });

    /*it('should allow update only e-mail', function(done) {
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
    });*/

    it('should not allow user to update password', function(done) {
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

          passgen('12345678').hash(sails.config.session.secret, function (err, hashedPassword) {
            if (err) return done(err);
            DBService.select('sicksense', '*', [
                { field: 'id = $', value: sicksenseID.id }
              ])
              .then(function (result) {
                result.rows.length.should.equal(1);
                result.rows[0].password.should.equal(hashedPassword);
                done();
              })
              .catch(function (err) {
                done(err);
              });
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

          DBService.select('sicksense_users', 'sicksense_id', [
              { field: 'user_id = $', value: res.body.response.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(1);
              return EmailSubscriptionsService.isSubscribed({ id: result.rows[0].sicksense_id })
                .then(function (isSubscribed) {
                  isSubscribed.should.be.true;
                  done();
                });
            })
            .catch(function (err) {
              done(err);
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

          DBService.select('sicksense_users', 'sicksense_id', [
              { field: 'user_id = $', value: res.body.response.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(1);
              return EmailSubscriptionsService.isSubscribed({ id: result.rows[0].sicksense_id })
                .then(function (isSubscribed) {
                  isSubscribed.should.be.false;
                  done();
                });
            })
            .catch(function (err) {
              done(err);
            });

        });
    });

  });

  describe('[GET] /users/:id', function() {
    var user, accessToken;

    before(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createUser({ email: "siriwut@opendream.co.th", password: "12345678" }, true);
        })
        .then(function() {
          return TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" }, true);
        })
        .then(function(_user) {
          user = _user;
          accessToken = user.accessToken;
          return EmailSubscriptionsService.subscribe(user)
        })
        .then(function (subscribe) {
          return TestHelper.createSicksenseID({ email: "siriwat@opendream.co.th", password: "12345678" }, true);
        })
        .then(function (sicksense) {
          return TestHelper.connectSicksenseAndUser(sicksense, user)
        })
        .then(function (sicksense) {
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
    var data = {};
    var user, token, mailserviceSend;

    before(function(done) {
      mailserviceSend = MailService.send;
      MailService.send = when.resolve;
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createSicksenseID({
            email: "john@example.com",
            password: "12345678"
          });
        })
        .then(function(sicksenseID) {
          data.sicksenseID = sicksenseID;
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

          DBService.select('onetimetoken', '*', [
              { field: 'user_id = $', value: data.sicksenseID.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(1);
              result.rows[0].token.length.should.greaterThan(0);
              result.rows[0].type.should.equal('user.resetPassword');
              result.rows[0].expired.should.greaterThan(new Date());

              data.tokenObject = result.rows[0];
              done();
            })
            .catch(function (err) {
              done(err);
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

          DBService.select('onetimetoken', '*', [
              { field: 'user_id = $', value: data.sicksenseID.id }
            ])
            .then(function (result) {
              result.rows.length.should.equal(1);
              result.rows[0].token.should.not.equal(data.tokenObject.token);
              result.rows[0].expired.should.greaterThan(data.tokenObject.expired);
              done();
            })
            .catch(function (err) {
              done(err);
            });

        });
    });

  });

  describe('[POST] /users/reset-password', function() {
    var user, sicksenseID, token, mailserviceSend;
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

    beforeEach(function(done) {
      mailserviceSend = MailService.send;
      MailService.send = when.resolve;

      TestHelper.clearAll()
        .then(function () {
          return TestHelper.createSicksenseID({
            email: 'nirut@opendream.co.th',
            password: '12345678',
          })
          .then(function (_sicksenseID) {
            sicksenseID = _sicksenseID;
            return TestHelper.createUser({
              email: 'A001@sicksense.com',
              password: 'A001'
            }, false);
          })
          .then(function (_user) {
            user = _user;
            return TestHelper.connectSicksenseAndUser(sicksenseID, user);
          })
          .catch(function (err) {
            done(err);
          });
        })
        .then(function() {
          return when.map(mockTokens, function(token) {
            return DBService.insert('onetimetoken', [
              { field: 'user_id', value: sicksenseID.id },
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

    afterEach(function(done) {
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

    it('should error if password is shorter than 8 characters', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .send({ password: '1234567' })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.should.have.properties([ 'password' ]);
          res.body.meta.invalidFields.password.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');

          done();
        });
    });

    it('should error if password is longer than 64 characters', function(done) {
      request(sails.hooks.http.app)
        .post('/users/reset-password')
        .send({ 
          password: 'UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST1-65'
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.should.have.properties([ 'password' ]);
          res.body.meta.invalidFields.password.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');

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

          DBService.select('sicksense', 'password', [
              { field: 'id = $', value : sicksenseID.id }
            ])
            .then(function(result) {
              passgen('new-password').hash(sails.config.session.secret, function(err, hashedPassword) {
                result.rows[0].password.should.equal(hashedPassword);

                DBService.select('onetimetoken', '*', [
                    { field: 'user_id = $', value: sicksenseID.id },
                    { field: 'type = $', value: 'user.resetPassword' }
                  ])
                .then(function(result) {
                  result.rows.length.should.equal(0);
                })
                .then(function() {
                  return DBService.select('accesstoken', '*', [
                      { field: '"userId" = $', value: user.id }
                    ])
                })
                .then(function (result) {
                  result.rows.length.should.equal(0);
                  done();
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

      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createSicksenseID({
            email: 'verifyemailtest001@opendream.co.th',
            password: 'password-here-is-ignored'
          });
        })
        .then(function (sicksenseID) {
          data.sicksenseID = sicksenseID;
        })
        .then(function () {
          return TestHelper.createUser({
            email: 'randomedtotestverify001@sicksense.com',
            password: 'password-here-is-ignored'
          });
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
        .then(function () {
          done();
        })
        .catch(function (err) {
          done(err);
        });

    });

    it('should require `token` field', function (done) {
      request(sails.hooks.http.app)
        .post('/users/verify')
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(400);
          res.body.meta.errorType.should.equal("Bad Request");

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

            // Should mark user as verified.
            DBService.select('sicksense', 'is_verify', [
              { field: 'id = $', value: data.sicksenseID.id }
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

  describe('[POST] /users/request-verify : re-send verification e-mail', function () {
    var data = {};

    before(function (done) {

      // create new user
      DBService
      .insert('users', [
        { field: 'email', value: 'request-verify-001@sicksense.com' },
        { field: 'password', value: 'text-here-is-ignored' }
      ])
      // create sicksense id
      .then(function (result) {
        data.user = result.rows[0];

        return DBService.insert('sicksense', [
          { field: 'email', value: 'request-verify-001@opendream.co.th' },
          { field: 'password', value: 'password-here-is-ignored' },
          { field: '"createdAt"', value: new Date() }
        ]);
      })
      // create sicksense id with no devices(users) linked.
      .then(function (result) {
        data.sicksense = result.rows[0];

        return DBService.insert('sicksense', [
          { field: 'email', value: 'request-verify-002@opendream.co.th' },
          { field: 'password', value: 'password-here-is-ignored' },
          { field: '"createdAt"', value: new Date() }
        ]);
      })
      .then(function (result) {
        data.unlinked_sicksense = result.rows[0];
        // assign verification token
        return OnetimeTokenService.create('user.verifyEmail', data.sicksense.id, 10)
          .then(function (tokenObject) {
            data.tokenObject = tokenObject;
          });
      })
      .then(function (result) {
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

    it('should validate `email` is required', function (done) {
        request(sails.hooks.http.app)
          .post('/users/request-verify')
          .expect(400)
          .end(function (err) {
            if (err) return done(new Error(err));
            done();
          });
    });

    it('should validate `email` is valid', function (done) {
        request(sails.hooks.http.app)
          .post('/users/request-verify')
          .send({
            email: 'this-is-not-valid@email',
          })
          .expect(400)
          .end(function (err) {
            if (err) return done(new Error(err));
            done();
          });
    });

    it('should validate `email` exists', function (done) {
        request(sails.hooks.http.app)
          .post('/users/request-verify')
          .send({
            email: 'this-doesnt-exits@email.com',
          })
          .expect(400)
          .end(function (err, res) {
            if (err) return done(new Error(err));

            res.body.meta.errorMessage.should.match(/(not found)|(ไม่พบ)/);

            done();
          });
    });

    it('should re-send `email` if all parameter is ok', function (done) {
        var tmp = {};

        _before();

        request(sails.hooks.http.app)
          .post('/users/request-verify')
          .send({
            email: 'request-verify-001@opendream.co.th',
          })
          .expect(200)
          .end(function (err, res) {
            if (err) return done(new Error(err));

            DBService.select('onetimetoken', 'token', [
              { field: 'token = $', value: data.tokenObject.token }
            ])
            .then(function (result) {
              tmp.resultOld = result;
              return DBService.select('onetimetoken', 'token', [
                { field: 'user_id = $', value: data.sicksense.id }
              ]);
            })
            .then(function (result) {
              tmp.resultNew = result;
            })
            .then(function () {
              tmp.resultOld.rows.should.have.length(0);
              tmp.resultNew.rows.should.have.length(1);

              tmp.count.should.equal(1);
              tmp.text.should.containEql(tmp.resultNew.rows[0].token);
              tmp.html.should.containEql(tmp.resultNew.rows[0].token);
              tmp.to.should.equal('request-verify-001@opendream.co.th');

              done();
            })
            .catch(done)
            .finally(_after);
          });

        function _before() {
          tmp.count = 0;
          tmp.send = MailService.send;
          MailService.send = function (subject, text, from, to, html) {
            tmp.text = text;
            tmp.html = html;
            tmp.to = to;
            tmp.count++;
          };
        }

        function _after() {
          MailService.send = tmp.send;
        }
    });

    it('should warn and won\'t send e-mail if users are already verified', function (done) {
        var tmp = {};

        _before();

        DBService.update('sicksense', [
          { field: 'is_verify = $', value: 't' }
        ], [
          { field: 'id = $' , value: data.sicksense.id }
        ])
        .then(function () {
          request(sails.hooks.http.app)
            .post('/users/request-verify')
            .send({
              email: 'request-verify-001@opendream.co.th',
            })
            .expect(400)
            .end(function (err, res) {
              if (err) return done(new Error(err));

              res.body.meta.errorSubType.should.equal('email_is_already_verified');
              tmp.count.should.equal(0);

              _after();
              done();
            });
        });

        function _before() {
          tmp.count = 0;
          tmp.send = MailService.send;
          MailService.send = function (subject, body, from, to, html) {
            tmp.body = body;
            tmp.html = html;
            tmp.to = to;
            tmp.count++;
          };
        }

        function _after() {
          MailService.send = tmp.send;
        }
    });

    it('should not required any devices(users) to request verification e-mail', function (done) {
        var tmp = {};

        _before();

        request(sails.hooks.http.app)
          .post('/users/request-verify')
          .send({
            email: 'request-verify-002@opendream.co.th',
          })
          .expect(200)
          .end(function (err, res) {
            if (err) return done(new Error(err));

            tmp.count.should.equal(1);
            tmp.to.should.equal('request-verify-002@opendream.co.th');

            _after();
            done();
          });

        function _before() {
          tmp.count = 0;
          tmp.send = MailService.send;
          MailService.send = function (subject, body, from, to, html) {
            tmp.body = body;
            tmp.html = html;
            tmp.to = to;
            tmp.count++;
          };
        }

        function _after() {
          MailService.send = tmp.send;
        }
    });
  });

  describe('[POST] /users/:id/change-password', function () {
    var user, sicksenseID;

    beforeEach(function(done) {
      TestHelper.clearAll()
        .then(function() {
          return TestHelper.createSicksenseID({
            email: "siriwat@opendream.co.th",
            password: "12345678"
          });
        })
        .then(function (_sicksenseID) {
          sicksenseID = _sicksenseID;
          return TestHelper.createUser({
            email: 'A001@sicksense.com',
            password: 'A001'
          }, true);
        })
        .then(function(_user) {
          user = _user;
          return TestHelper.connectSicksenseAndUser(sicksenseID, user);
        })
        .then(function () {
          done();
        })
        .catch(done);
    });

    afterEach(function(done) {
      TestHelper.clearAll()
        .then(done, done);
    });

    it('should error when nothing is provided', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id + '/change-password')
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);

          done();
        });
    });

    it('should error when token is provided but others', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id + '/change-password')
        .query({
          accessToken: user.accessToken
        })
        .send()
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.should.have.properties([ 'oldPassword' ]);
          res.body.meta.invalidFields.should.have.properties([ 'newPassword' ]);

          done();
        });
    });

    it('should error if token is invalid', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id + '/change-password')
        .query({
          accessToken: 'invalid-token'
        })
        .send({
          oldPassword: '12345678',
          newPassword: 'new-password'
        })
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);

          done();
        });
    });

    it('should error if old password is wrong', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id + '/change-password')
        .query({
          accessToken: user.accessToken
        })
        .send({
          oldPassword: 'password-is-wrong',
          newPassword: 'new-password'
        })
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);

          done();
        });
    });

    it('should error if password is shorter than 8 characters', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id + '/change-password')
        .query({
          accessToken: user.accessToken
        })
        .send({
          oldPassword: 'short',
          newPassword: 'shorter'
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.should.have.properties([ 'oldPassword', 'newPassword' ]);
          res.body.meta.invalidFields.oldPassword.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');
          res.body.meta.invalidFields.newPassword.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');

          done();
        });
    });

    it('should error if password is longer than 64 characters', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id + '/change-password')
        .query({
          accessToken: user.accessToken
        })
        .send({
          oldPassword: 'UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST1-65',
          newPassword: 'UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST1-UUID-SICKSENSE-TEST2-65'
        })
        .expect(400)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.invalidFields.should.have.properties([ 'oldPassword', 'newPassword' ]);
          res.body.meta.invalidFields.oldPassword.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');
          res.body.meta.invalidFields.newPassword.should.equal('กรุณากรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร และไม่เกิน 64 ตัวอักษร');

          done();
        });
    });

    it('should update password and return user object with accessToken', function(done) {
      request(sails.hooks.http.app)
        .post('/users/' + user.id + '/change-password')
        .query({
          accessToken: user.accessToken
        })
        .send({
          oldPassword: '12345678',
          newPassword: 'new-password'
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          DBService.select('sicksense', 'password', [
              { field: 'id = $', value : sicksenseID.id }
            ])
            .then(function (result) {
              passgen('new-password').hash(sails.config.session.secret, function(err, hashedPassword) {
                result.rows[0].password.should.equal(hashedPassword);

                DBService.select('accesstoken', '*', [
                    { field: '"userId" = $', value: user.id }
                  ])
                .then(function(result) {
                  result.rows.length.should.equal(0);
                  done();
                })
                .catch(done);
              })
            })
            .catch(done);

        });
    });
  });

});
