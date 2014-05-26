var when = require('when');
var request = require('supertest');

describe('DashboardController Test', function() {
  var user, accessToken;

  before(function(done) {
    TestHelper.clearAll()
      .then(_.bind(TestHelper.createUser, { email: "siriwat@opendream.co.th", password: "12345678" }))
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

  describe('[GET] /dashboard', function() {
    var user1, user2, user3;

    var report1 = {
      address: {
        subdistrict: "Samsen Nok",
        district: "Huai Khwang",
        city: "Bangkok"
      },
      locationByAddress: {
        latitude: 13.781730,
        longitude: 100.545357
      }
    };

    var report2 = {
      address: {
        subdistrict: "Samsen Ni",
        district: "Phaya Thai",
        city: "Bangkok"
      },
      locationByAddress: {
        latitude: 13.781730,
        longitude: 100.545357
      }
    };

    before(function(done) {
      TestHelper
        .createUser({
          email: "siriwat@opendream.co.th",
          password: "12345678",
          subdistrict: "Samsen Nok",
          district: "Huai Khwang",
          city: "Bangkok",
          latitude: 13.784730,
          longitude: 100.585747
        }, true)
        .then(function(result) {
          user1 = result;
          return TestHelper.createUser({
            email: "somsri@opendream.co.th",
            password: "12345678",
            subdistrict: "Samsen Ni",
            district: "Phaya Thai",
            city: "Bangkok",
            latitude: 13.781730,
            longitude: 100.545357
          }, true);
        })
        .then(function(result) {
          user2 = result;
          return TestHelper.createUser({
            email: "somchai@opendream.co.th",
            password: "12345678",
            subdistrict: "Sri Phum",
            district: "Amphoe Muang Chiang Mai",
            city: "Chiang Mai",
            latitude: 18.796209,
            longitude: 98.985741
          }, true);
        })
        .then(function(result) {
          user3 = result;
        })
        // user1 this week
        .then(function() {
          return TestHelper.createReport({
            address: report2.address,
            locationByAddress: report2.locationByAddress,
            isFine: false,
            symptoms: [ 'cough', 'fever' ],
            userId: user1.id
          });
        })
        // user1 this week second time.
        .then(function() {
          return TestHelper.createReport({
            address: report2.address,
            locationByAddress: report2.locationByAddress,
            userId: user1.id
          });
        })
        // user1 last week
        .then(function() {
          return TestHelper.createReport({
            address: report1.address,
            locationByAddress: report1.locationByAddress,
            createdAt: (new Date()).addDays(-7),
            isFine: false,
            symptoms: [ 'sore-throat' ],
            userId: user1.id
          });
        })
        // user2 this week
        .then(function() {
          return TestHelper.createReport({
            address: report2.address,
            locationByAddress: report2.locationByAddress,
            isFine: false,
            symptoms: [ 'cough' ],
            userId: user2.id
          });
        })
        // user2 last week
        .then(function(result) {
          return TestHelper.createReport({
            address: report2.address,
            locationByAddress: report2.locationByAddress,
            createdAt: (new Date()).addDays(-7),
            isFine: false,
            symptoms: [ 'rash' ],
            userId: user2.id
          });
        })
        // user3 this week
        .then(function() {
          return TestHelper.createReport({
            address: report1.address,
            locationByAddress: report1.locationByAddress,
            userId: user3.id
          });
        })
        // user3 last week
        .then(function(result) {
          user2 = result;
          return TestHelper.createReport({
            address: report1.address,
            locationByAddress: report1.locationByAddress,
            createdAt: (new Date()).addDays(-7),
            userId: user3.id
          });
        })
        .then(function() {
          done();
        })
        .catch(done);
    });

    it('should dashboard data', function(done) {
      request(sails.hooks.http.app)
        .get('/dashboard')
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.should.have.properties([
            'reports', 'ILI', 'numberOfReporters', 'numberOfReports', 'graphs', 'topSymptoms'
          ]);

          res.body.response.ILI.thisWeek.should.equal(66.67);
          res.body.response.ILI.lastWeek.should.equal(33.33);
          res.body.response.ILI.delta.should.equal(33.34);

          res.body.response.numberOfReporters.should.equal(3);
          res.body.response.numberOfReports.should.equal(4);

          res.body.response.graphs.BOE.should.be.Array;
          res.body.response.graphs.Sicksense.should.be.Array;

          res.body.response.topSymptoms.should.be.Array;
          res.body.response.topSymptoms[0].name.should.equal('cough');
          res.body.response.topSymptoms[0].percentOfReports.should.equal(100);
          res.body.response.topSymptoms[0].numberOfReports.should.equal(2);
          res.body.response.topSymptoms[1].name.should.equal('fever');
          res.body.response.topSymptoms[1].percentOfReports.should.equal(1);
          res.body.response.topSymptoms[0].numberOfReports.should.equal(1);

          done();
        });
    });
  });
});
