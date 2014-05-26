var request = require('supertest');
var when = require('when');
var pg = require('pg');
require('date-utils');

describe('ReportController test', function() {
  var user, accessToken;

  before(function(done) {
    TestHelper.clearAll()
      .then(_.bind(TestHelper.createUser, { email: "siriwat@opendream.co.th", password: "12345678", latitude: 13.781730, longitude: 100.545357 }))
      .then(function(_user) {
        user = _user;

        AccessTokenService.refresh(user.id).then(function(result) {
          accessToken = result;
          done();
        });
      })
      .catch(done);
  });

  after(function(done) {
    TestHelper.clearAll()
      .then(done)
      .catch(done);
  });

  describe('[GET] Reports', function() {

    before(function(done) {
      TestHelper.clearReports()
        .then(function() {
          return TestHelper.createReport({ userId: user.id, location: { latitude: 16.00, longitude: 103.00 } });
        })
        .then(function() {
          return TestHelper.createReport({ userId: user.id, location: { latitude: 15.00, longitude: 102.00 } });
        })
        .then(function() {
          return TestHelper.createReport({ userId: user.id, location: { latitude: 14.00, longitude: 101.00 } });
        })
        .then(function() {
          return TestHelper.createReport({
            userId: user.id,
            symptoms: [ "symptom_1", "symptom_2" ],
            location: {
              latitude: 13.00,
              longitude: 100.00
            }
          });
        })
        .then(function() { done(); })
        .catch(done);
    });

    it('should return reports', function(done) {
      request(sails.hooks.http.app)
        .get('/reports')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.reports.should.be.ok;
          res.body.response.reports.count.should.equal(4);
          res.body.response.reports.items.should.be.Array;
          res.body.response.reports.items.length.should.equal(4);

          var reports = res.body.response.reports.items;

          reports[0].should.have.properties([
            'id', 'isFine', 'symptoms', 'startedAt', 'location', 'address', 'locationByAddress',
            'userAddress', 'locationByUserAddress'
          ]);
          reports[0].symptoms.length.should.equal(2);
          reports[0].location.latitude.should.equal(13.00);
          reports[0].location.longitude.should.equal(100.00);
          // Must hide privacy data.
          reports[0].should.not.have.properties([ 'userId' ]);

          done();
        });
    });

    it('should respect offset and limit', function(done) {
      request(sails.hooks.http.app)
        .get('/reports')
        .query({ offset: 1, limit: 1 })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.reports.count.should.equal(4);
          res.body.response.reports.items.length.should.equal(1);

          res.body.response.reports.items[0].location.latitude.should.equal(14.00);
          res.body.response.reports.items[0].location.longitude.should.equal(101.00);

          done();
        });
    });

    it('should respect boundary parameters', function(done) {
      request(sails.hooks.http.app)
        .get('/reports')
        .query({ sw: "15.5,102.5", ne: "16.5,103.5" })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.reports.count.should.equal(1);
          res.body.response.reports.items.length.should.equal(1);

          res.body.response.reports.items[0].location.latitude.should.equal(16.00);
          res.body.response.reports.items[0].location.longitude.should.equal(103.00);

          done();
        });
    });

  });

  describe('[POST] Report', function() {

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

          res.body.response.address.subdistrict.should.equal("Samsen Nok");
          res.body.response.address.district.should.equal("Huai Khwang");
          res.body.response.address.city.should.equal("Bangkok");
          res.body.response.locationByAddress.latitude.should.equal(13.784730);
          res.body.response.locationByAddress.longitude.should.equal(100.585747);

          res.body.response.userAddress.subdistrict.should.equal("Samsen Nok");
          res.body.response.userAddress.district.should.equal("Huai Khwang");
          res.body.response.userAddress.city.should.equal("Bangkok");
          res.body.response.locationByUserAddress.latitude.should.equal(13.784730);
          res.body.response.locationByUserAddress.longitude.should.equal(100.585747);

          res.body.response.location.latitude.should.equal(13.791343);
          res.body.response.location.longitude.should.equal(100.587473);
          // More flexible. Server may cut off the long more info text.
          res.body.response.moreInfo.length.should.greaterThan(10);

          // Must hide privacy data.
          res.body.response.should.not.have.properties([ 'userId' ]);

          // Also check in DB too.
          pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
            if (err) return done(err);

            client.query('SELECT *, ST_AsText(geom) as latlon FROM reports WHERE id=$1', [ res.body.response.id ], function(err, result) {
              pgDone();
              if (err) return done(err);

              var report = result.rows[0];

              report.userId.should.equal(user.id);
              report.latlon.should.equal('POINT(100.587473 13.791343)');

              report.subdistrict.should.equal("Samsen Nok");
              report.district.should.equal("Huai Khwang");
              report.city.should.equal("Bangkok");
              report.addressLatitude.should.equal(13.784730);
              report.addressLongitude.should.equal(100.585747);

              done();
            });
          });
        });
    });
  });

});
