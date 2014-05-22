var request = require('supertest');
var when = require('when');
require('date-utils');

describe('ReportController test', function() {
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

  describe('[POST] Report', function() {

    var accessToken;
    before(function(done) {
      TestHelper.createUser({ email: "siriwat@opendream.co.th", password: "12345678" })
        .then(function(user) {
          AccessTokenService.refresh(user.id).then(function(result) {
            accessToken = result;
            done();
          });
        });
    });


    it('should required `accessToken`', function(done) {
      request(sails.hooks.http.app)
        .post('/reports')
        .expect(403)
        .end(function(err, res) {
          if (err) return done(err);
          done();
        });
    });

    describe('Parameter validation', function() {


      it('should validate `isFine` field', function(done) {
        request(sails.hooks.http.app)
          .post('/reports')
          .query({ accessToken: accessToken.token })
          .expect(400)
          .end(function(err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.isFine.match(/isFine.*is required/);
            done();
          });
      });

      describe('Validate `symptoms` field', function() {
        it('should require if `isFine` has no value', function(done) {
          request(sails.hooks.http.app)
            .post('/reports')
            .query({ accessToken: accessToken.token })
            .expect(400)
            .end(function(err, res) {
              if (err) return done(err);
              res.body.meta.invalidFields.symptoms.match(/symptoms.*is required/);
              done();
            });
        });

        it('should require if `isFine` is `false`', function(done) {
          request(sails.hooks.http.app)
            .post('/reports')
            .query({ accessToken: accessToken.token })
            .send({ isFine: false })
            .expect(400)
            .end(function(err, res) {
              if (err) return done(err);
              res.body.meta.invalidFields.symptoms.match(/symptoms.*is required/);
              done();
            });
        });

        it('should not require if `isFine` is `true`', function(done) {
          request(sails.hooks.http.app)
            .post('/reports')
            .query({ accessToken: accessToken.token })
            .send({ isFine: true })
            .expect(400)
            .end(function(err, res) {
              if (err) return done(err);
              res.body.meta.invalidFields.should.not.have.property('symptoms');
              done();
            });
        });

        it('should not pass validation, if value is not array', function(done) {
          request(sails.hooks.http.app)
            .post('/reports')
            .query({ accessToken: accessToken.token })
            .send({ symptoms: "string value" })
            .expect(400)
            .end(function(err, res) {
              if (err) return done(err);
              res.body.meta.invalidFields.symptoms.match(/symptoms.*is not valid/);
              done();
            });
        });

        it('should not pass validation, if `isFine` is `false` but provide empty array', function(done) {
          request(sails.hooks.http.app)
            .post('/reports')
            .query({ accessToken: accessToken.token })
            .send({ symptoms: [] })
            .expect(400)
            .end(function(err, res) {
              if (err) return done(err);
              res.body.meta.invalidFields.symptoms.match(/symptoms.*is required/);
              done();
            });
        });
      });

      it('should validate `animalContact` field', function(done) {
        request(sails.hooks.http.app)
          .post('/reports')
          .query({ accessToken: accessToken.token })
          .expect(400)
          .end(function(err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.animalContact.match(/animalContact.*is required/);
            done();
          });
      });

      it('should validate `startedAt` field', function(done) {
        request(sails.hooks.http.app)
          .post('/reports')
          .query({ accessToken: accessToken.token })
          .expect(400)
          .end(function(err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.startedAt.match(/startedAt.*is required/);

            // Check if is valid date value.
            request(sails.hooks.http.app)
              .post('/reports')
              .query({ accessToken: accessToken.token })
              .send({ startedAt: "this is not a date" })
              .expect(400)
              .end(function(err, res) {
                if (err) return done(err);
                res.body.meta.invalidFields.startedAt.match(/startedAt.*is not valid/);
                done();
              });
          });
      });

      it('should validate `location` field', function(done) {
        request(sails.hooks.http.app)
          .post('/reports')
          .query({ accessToken: accessToken.token })
          .expect(400)
          .end(function(err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.location.match(/location.*is required/);
            done();
          });
      });

      it('should validate `location.latitude` field', function(done) {
        request(sails.hooks.http.app)
          .post('/reports')
          .query({ accessToken: accessToken.token })
          .expect(400)
          .end(function(err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.location.match(/location.*is required/);

            request(sails.hooks.http.app)
              .post('/reports')
              .query({ accessToken: accessToken.token })
              .send({
                location: {
                  latitude: 200.00
                }
              })
              .expect(400)
              .end(function(err, res) {
                if (err) return done(err);
                res.body.meta.invalidFields['location.latitude'].match(/latitude.*is not valid/);
                done();
              });
          });
      });

      it('should validate `location.longitude` field', function(done) {
        request(sails.hooks.http.app)
          .post('/reports')
          .query({ accessToken: accessToken.token })
          .expect(400)
          .end(function(err, res) {
            if (err) return done(err);
            res.body.meta.invalidFields.location.match(/location.*is required/);

            request(sails.hooks.http.app)
              .post('/reports')
              .query({ accessToken: accessToken.token })
              .send({
                location: {
                  longitude: 200.00
                }
              })
              .expect(400)
              .end(function(err, res) {
                if (err) return done(err);
                res.body.meta.invalidFields['location.longitude'].match(/longitude.*is not valid/);
                done();
              });
          });
      });
    });

    it('should create new report if pass validation', function(done) {
      var startedAt = (new Date()).addDays(-3);
      request(sails.hooks.http.app)
        .post('/reports')
        .query({ accessToken: accessToken.token })
        .send({
          isFine: false,
          symptoms: [ "symptom_1", "symptom_2" ],
          animalContact: true,
          startedAt: startedAt,
          location: {
            latitude: 13.791343,
            longitude: 100.587473
          },
          moreInfo: "Symptoms of H1N1 swine flu are like regular flu symptoms and include fever, \
          cough, sore throat, runny nose, body aches, headache, chills, and fatigue. Many people\
           with swine flu have had diarrhea and vomiting."
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.meta.status.should.equal(200);
          res.body.response.id.should.be.ok;
          res.body.response.isFine.should.equal(false);
          res.body.response.symptoms.should.be.Array;
          res.body.response.symptoms.indexOf('symptom_1').should.not.equal(-1);
          res.body.response.symptoms.indexOf('symptom_2').should.not.equal(-1);
          res.body.response.animalContact.should.equal(true);
          (new Date(res.body.response.startedAt)).getTime().should.equal(startedAt.getTime());
          res.body.response.location.latitude.should.equal(13.791343);
          res.body.response.location.longitude.should.equal(100.587473);
          // More flexible. Server may cut off the long more info text.
          res.body.response.moreInfo.length.should.greaterThan(10);

          // Must hide privacy data.
          res.body.response.should.not.have.properties([ 'userId' ]);

          done();
        });
    });
  });

});
