var when = require('when');
var request = require('supertest');
var moment = require('moment');
var pg = require('pg');
require('date-utils');

function getFirstDayOfWeek(date) {
  var dateObj;
  if (typeof date == 'string') {
    dateObj = new Date(Date.parse(string));
  }
  else {
    dateObj = new Date(date);
  }

  dateObj.clearTime();
  return dateObj.addDays(-1 * dateObj.getDay());
}

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

    var report3 = {
      address: {
        subdistrict: "Sri Phum",
        district: "Amphoe Muang Chiang Mai",
        city: "Chiang Mai"
      },
      locationByAddress: {
        latitude: 18.796209,
        longitude: 98.985741
      }
    };

    var currentDate = (new Date()).addDays(-7);
    var weekAgoDate = (new Date(currentDate)).addDays(-7);

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
            address: report1.address,
            locationByAddress: report1.locationByAddress,
            isFine: false,
            symptoms: [ 'cough', 'fever' ],
            userId: user1.id,
            startedAt: currentDate
          });
        })
        // user1 this week second time.
        .then(function() {
          return TestHelper.createReport({
            address: report1.address,
            locationByAddress: report1.locationByAddress,
            userId: user1.id,
            startedAt: currentDate
          });
        })
        // user1 last week
        .then(function() {
          return TestHelper.createReport({
            address: report1.address,
            locationByAddress: report1.locationByAddress,
            isFine: false,
            symptoms: [ 'sore-throat' ],
            userId: user1.id,
            startedAt: weekAgoDate
          });
        })
        // user2 this week
        .then(function() {
          return TestHelper.createReport({
            address: report2.address,
            locationByAddress: report2.locationByAddress,
            isFine: false,
            symptoms: [ 'cough' ],
            userId: user2.id,
            startedAt: currentDate,
          });
        })
        // user2 last week
        .then(function(result) {
          return TestHelper.createReport({
            address: report2.address,
            locationByAddress: report2.locationByAddress,
            isFine: false,
            symptoms: [ 'rash' ],
            userId: user2.id,
            startedAt: weekAgoDate
          });
        })
        // user3 this week
        .then(function() {
          return TestHelper.createReport({
            address: report3.address,
            locationByAddress: report3.locationByAddress,
            userId: user3.id,
            startedAt: currentDate
          });
        })
        // user3 last week
        .then(function() {
          return TestHelper.createReport({
            address: report3.address,
            locationByAddress: report3.locationByAddress,
            userId: user3.id,
            startedAt: weekAgoDate
          });
        })
        // user3 before last week
        .then(function() {
          return TestHelper.createReport({
            address: report3.address,
            locationByAddress: report3.locationByAddress,
            userId: user3.id,
            startedAt: (new Date(weekAgoDate)).addDays(-7)
          });
        })
        .then(function() {
          return when.promise(function(resolve, reject) {
            pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
              if (err) return reject(new Error(err));

              client.query('SELECT * FROM reports_summary_by_week', function(err, result) {
                if (err) return reject(err);
                //console.log('##', result.rows);
                resolve();
              });
            });
          });
        })
        .then(function() {
          return when.promise(function(resolve, reject) {
            pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
              if (err) {
                return reject(new Error(err));
              }

              client.query("DELETE FROM ililog", function(err, result) {
                if (err) {
                  return reject(new Error(err));
                }
                resolve();
              });
            });
          });
        })
        .then(function() {
          return when.promise(function(resolve, reject) {
            pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
              if (err) {
                return reject(new Error(err));
              }

              var thisYear = moment().year().toString();
              var thisWeek = moment().weeks();

              var docs = [
                { source: 'boe', date: moment(thisYear).weeks(thisWeek - 1).day(0).toDate().clearTime(), year: thisYear, week: thisWeek - 1, value: 10.05 },
                { source: 'boe', date: moment(thisYear).weeks(thisWeek + 0).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 0, value: 11.00 },
                { source: 'boe', date: moment(thisYear).weeks(thisWeek + 1).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 1, value: 11.05 },
                { source: 'boe', date: moment(thisYear).weeks(thisWeek + 2).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 2, value: 12.00 },
                { source: 'boe', date: moment(thisYear).weeks(thisWeek + 3).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 3, value: 12.05 },
                { source: 'boe', date: moment(thisYear).weeks(thisWeek + 4).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 4, value: 13.00 },
                { source: 'sicksense', date: moment(thisYear).weeks(thisWeek - 1).day(0).toDate().clearTime(), year: thisYear, week: thisWeek - 1, value: 11.05 },
                { source: 'sicksense', date: moment(thisYear).weeks(thisWeek + 0).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 0, value: 12.00 },
                { source: 'sicksense', date: moment(thisYear).weeks(thisWeek + 1).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 1, value: 12.05 },
                { source: 'sicksense', date: moment(thisYear).weeks(thisWeek + 2).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 2, value: 13.00 },
                { source: 'sicksense', date: moment(thisYear).weeks(thisWeek + 3).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 3, value: 13.05 },
                { source: 'sicksense', date: moment(thisYear).weeks(thisWeek + 4).day(0).toDate().clearTime(), year: thisYear, week: thisWeek + 4, value: 14.00 },
              ];

              when.map(docs, function (doc) {
                var insertQuery = "INSERT INTO ililog (source, date, year, week, value, \"createdAt\", \"updatedAt\") VALUES ($1, $2, $3, $4, $5, $6, $7)";
                var insertValue = [doc.source, doc.date, doc.year, doc.week, doc.value, new Date(), new Date()];

                client.query(insertQuery, insertValue, function (err, result) {
                  pgDone();

                  if (err) {
                    return reject(new Error(err));
                  }

                  resolve();
                });
              });

            });
          });
        })
        .then(function() {
          done();
        })
        .catch(done);
    });

    it('should return dashboard data of current week', function(done) {
      request(sails.hooks.http.app)
        .get('/dashboard')
        .query({
          city: 'all'
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.should.have.properties([
            'reports', 'ILI', 'numberOfReporters', 'numberOfReports', 'graphs', 'topSymptoms'
          ]);

          res.body.response.reports.count.should.equal(3);
          res.body.response.reports.items.length.should.equal(3);
          res.body.response.reports.items[0].should.have.properties([
            'subdistrict', 'district', 'city', 'latitude', 'longitude', 'fineCount', 'sickCount', 'total'
          ]);

          var district1 = _.find(res.body.response.reports.items, { subdistrict: 'Samsen Nok' });
          var district2 = _.find(res.body.response.reports.items, { subdistrict: 'Samsen Ni' });
          var district3 = _.find(res.body.response.reports.items, { subdistrict: 'Sri Phum' });

          district1.fineCount.should.equal(0);
          district1.sickCount.should.equal(1);
          district1.total.should.equal(1);

          district2.fineCount.should.equal(0);
          district2.sickCount.should.equal(1);
          district2.total.should.equal(1);

          district3.fineCount.should.equal(1);
          district3.sickCount.should.equal(0);
          district3.total.should.equal(1);

          res.body.response.ILI.thisWeek.toString().should.equal('66.67');
          res.body.response.ILI.lastWeek.toString().should.equal('33.33');
          res.body.response.ILI.delta.toString().should.equal('33.34');

          res.body.response.numberOfReporters.should.equal(3);
          res.body.response.numberOfFinePeople.should.equal(1);
          res.body.response.numberOfSickPeople.should.equal(2);
          res.body.response.percentOfFinePeople.toString().should.equal('33.33');
          res.body.response.percentOfSickPeople.toString().should.equal('66.67');

          res.body.response.graphs.BOE.should.be.Array;
          res.body.response.graphs.BOE.length.should.equal(6);

          var date = moment().toDate().clearTime();

          Date.parse(res.body.response.graphs.BOE[0].date).should.equal(moment(date).add('w', -1).day(0)._d.getTime());
          res.body.response.graphs.BOE[0].value.should.equal(10.05);
          Date.parse(res.body.response.graphs.BOE[1].date).should.equal(moment(date).day(0)._d.getTime());
          res.body.response.graphs.BOE[1].value.should.equal(11.00);
          Date.parse(res.body.response.graphs.BOE[2].date).should.equal(moment(date).add('w', 1).day(0)._d.getTime());
          res.body.response.graphs.BOE[2].value.should.equal(11.05);
          Date.parse(res.body.response.graphs.BOE[3].date).should.equal(moment(date).add('w', 2).day(0)._d.getTime());
          res.body.response.graphs.BOE[3].value.should.equal(12.00);
          Date.parse(res.body.response.graphs.BOE[4].date).should.equal(moment(date).add('w', 3).day(0)._d.getTime());
          res.body.response.graphs.BOE[4].value.should.equal(12.05);
          Date.parse(res.body.response.graphs.BOE[5].date).should.equal(moment(date).add('w', 4).day(0)._d.getTime());
          res.body.response.graphs.BOE[5].value.should.equal(13.00);

          res.body.response.graphs.SickSense.should.be.Array;
          res.body.response.graphs.SickSense.length.should.equal(6);

          Date.parse(res.body.response.graphs.SickSense[0].date).should.equal(moment(date).add('w', -1).day(0)._d.getTime());
          res.body.response.graphs.SickSense[0].value.should.equal(11.05);
          Date.parse(res.body.response.graphs.SickSense[1].date).should.equal(moment(date).day(0)._d.getTime());
          res.body.response.graphs.SickSense[1].value.should.equal(12.00);
          Date.parse(res.body.response.graphs.SickSense[2].date).should.equal(moment(date).add('w', 1).day(0)._d.getTime());
          res.body.response.graphs.SickSense[2].value.should.equal(12.05);
          Date.parse(res.body.response.graphs.SickSense[3].date).should.equal(moment(date).add('w', 2).day(0)._d.getTime());
          res.body.response.graphs.SickSense[3].value.should.equal(13.00);
          Date.parse(res.body.response.graphs.SickSense[4].date).should.equal(moment(date).add('w', 3).day(0)._d.getTime());
          res.body.response.graphs.SickSense[4].value.should.equal(13.05);
          Date.parse(res.body.response.graphs.SickSense[5].date).should.equal(moment(date).add('w', 4).day(0)._d.getTime());
          res.body.response.graphs.SickSense[5].value.should.equal(14.00);

          res.body.response.topSymptoms.should.be.Array;
          res.body.response.topSymptoms[0].name.should.equal('cough');
          res.body.response.topSymptoms[0].percentOfReports.should.approximately(66.66, 0.01);
          res.body.response.topSymptoms[0].numberOfReports.should.equal(2);
          res.body.response.topSymptoms[1].name.should.equal('fever');
          res.body.response.topSymptoms[1].percentOfReports.should.approximately(33.33, 0.01);
          res.body.response.topSymptoms[1].numberOfReports.should.equal(1);

          done();
        });
    });

    it('should return dashboard data of `city` if specify', function(done) {
      request(sails.hooks.http.app)
        .get('/dashboard')
        .query({
          city: "Bangkok"
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.should.have.properties([
            'reports', 'ILI', 'numberOfReporters', 'numberOfReports', 'graphs', 'topSymptoms'
          ]);

          res.body.response.reports.count.should.equal(2);
          res.body.response.reports.items.length.should.equal(2);
          res.body.response.reports.items[0].should.have.properties([
            'subdistrict', 'district', 'city', 'latitude', 'longitude', 'fineCount', 'sickCount', 'total'
          ]);

          var district1 = _.find(res.body.response.reports.items, { subdistrict: 'Samsen Nok' });
          var district2 = _.find(res.body.response.reports.items, { subdistrict: 'Samsen Ni' });

          district1.fineCount.should.equal(0);
          district1.sickCount.should.equal(1);
          district1.total.should.equal(1);

          district2.fineCount.should.equal(0);
          district2.sickCount.should.equal(1);
          district2.total.should.equal(1);

          res.body.response.ILI.thisWeek.should.equal(100);
          res.body.response.ILI.lastWeek.should.equal(50);
          res.body.response.ILI.delta.should.equal(50);

          res.body.response.numberOfReporters.should.equal(2);
          res.body.response.numberOfFinePeople.should.equal(0);
          res.body.response.numberOfSickPeople.should.equal(2);
          res.body.response.percentOfFinePeople.should.equal(0);
          res.body.response.percentOfSickPeople.should.equal(100);

          res.body.response.graphs.BOE.should.be.Array;
          res.body.response.graphs.BOE.length.should.equal(6);

          var date = new Date().clearTime();

          Date.parse(res.body.response.graphs.BOE[0].date).should.equal(moment(date).add('w', -1).day(0)._d.getTime());
          res.body.response.graphs.BOE[0].value.should.equal(10.05);
          Date.parse(res.body.response.graphs.BOE[1].date).should.equal(moment(date).day(0)._d.getTime());
          res.body.response.graphs.BOE[1].value.should.equal(11.00);
          Date.parse(res.body.response.graphs.BOE[2].date).should.equal(moment(date).add('w', 1).day(0)._d.getTime());
          res.body.response.graphs.BOE[2].value.should.equal(11.05);
          Date.parse(res.body.response.graphs.BOE[3].date).should.equal(moment(date).add('w', 2).day(0)._d.getTime());
          res.body.response.graphs.BOE[3].value.should.equal(12.00);
          Date.parse(res.body.response.graphs.BOE[4].date).should.equal(moment(date).add('w', 3).day(0)._d.getTime());
          res.body.response.graphs.BOE[4].value.should.equal(12.05);
          Date.parse(res.body.response.graphs.BOE[5].date).should.equal(moment(date).add('w', 4).day(0)._d.getTime());
          res.body.response.graphs.BOE[5].value.should.equal(13.00);

          res.body.response.graphs.SickSense.should.be.Array;
          res.body.response.graphs.SickSense.length.should.equal(6);

          Date.parse(res.body.response.graphs.SickSense[0].date).should.equal(moment(date).add('w', -1).day(0)._d.getTime());
          res.body.response.graphs.SickSense[0].value.should.equal(11.05);
          Date.parse(res.body.response.graphs.SickSense[1].date).should.equal(moment(date).day(0)._d.getTime());
          res.body.response.graphs.SickSense[1].value.should.equal(12.00);
          Date.parse(res.body.response.graphs.SickSense[2].date).should.equal(moment(date).add('w', 1).day(0)._d.getTime());
          res.body.response.graphs.SickSense[2].value.should.equal(12.05);
          Date.parse(res.body.response.graphs.SickSense[3].date).should.equal(moment(date).add('w', 2).day(0)._d.getTime());
          res.body.response.graphs.SickSense[3].value.should.equal(13.00);
          Date.parse(res.body.response.graphs.SickSense[4].date).should.equal(moment(date).add('w', 3).day(0)._d.getTime());
          res.body.response.graphs.SickSense[4].value.should.equal(13.05);
          Date.parse(res.body.response.graphs.SickSense[5].date).should.equal(moment(date).add('w', 4).day(0)._d.getTime());
          res.body.response.graphs.SickSense[5].value.should.equal(14.00);

          res.body.response.topSymptoms.should.be.Array;
          res.body.response.topSymptoms[0].name.should.equal('cough');
          res.body.response.topSymptoms[0].percentOfReports.should.approximately(66.66, 0.01);
          res.body.response.topSymptoms[0].numberOfReports.should.equal(2);
          res.body.response.topSymptoms[1].name.should.equal('fever');
          res.body.response.topSymptoms[1].percentOfReports.should.approximately(33.33, 0.01);
          res.body.response.topSymptoms[1].numberOfReports.should.equal(1);

          done();
        });
    });

    it('should support case-insensitive `city` query too', function(done) {
      request(sails.hooks.http.app)
        .get('/dashboard')
        .query({
          city: "Bangkok"
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.should.have.properties([
            'reports', 'ILI', 'numberOfReporters', 'numberOfReports', 'graphs', 'topSymptoms'
          ]);

          res.body.response.reports.count.should.equal(2);

          done();
        });
    });

    it('should return dashboard data within specific `date`', function(done) {
      request(sails.hooks.http.app)
        .get('/dashboard')
        .query({
          city: 'all',
          date: (new Date()).addDays(-7)
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err);

          res.body.response.should.have.properties([
            'reports', 'ILI', 'numberOfReporters', 'numberOfReports', 'graphs', 'topSymptoms'
          ]);

          res.body.response.reports.count.should.equal(3);
          res.body.response.reports.items.length.should.equal(3);
          res.body.response.reports.items[0].should.have.properties([
            'subdistrict', 'district', 'city', 'latitude', 'longitude', 'fineCount', 'sickCount', 'total'
          ]);

          var district1 = _.find(res.body.response.reports.items, { subdistrict: 'Samsen Nok' });
          var district2 = _.find(res.body.response.reports.items, { subdistrict: 'Samsen Ni' });
          var district3 = _.find(res.body.response.reports.items, { subdistrict: 'Sri Phum' });

          district1.fineCount.should.equal(0);
          district1.sickCount.should.equal(1);
          district1.total.should.equal(1);

          district2.fineCount.should.equal(0);
          district2.sickCount.should.equal(1);
          district2.total.should.equal(1);

          district3.fineCount.should.equal(1);
          district3.sickCount.should.equal(0);
          district3.total.should.equal(1);

          res.body.response.ILI.thisWeek.should.approximately(33.33, 0.01);
          res.body.response.ILI.lastWeek.should.equal(0);
          res.body.response.ILI.delta.should.approximately(33.33, 0.01);

          res.body.response.numberOfReporters.should.equal(3);
          res.body.response.numberOfFinePeople.should.equal(1);
          res.body.response.numberOfSickPeople.should.equal(2);
          res.body.response.percentOfFinePeople.should.approximately(33.33, 0.01);
          res.body.response.percentOfSickPeople.should.approximately(66.67, 0.01);

          (res.body.response.percentOfFinePeople + res.body.response.percentOfSickPeople)
            .should.equal(100.00);

          res.body.response.graphs.BOE.should.be.Array;
          res.body.response.graphs.BOE.length.should.equal(6);

          var date = (new Date()).addDays(-7).clearTime();

          Date.parse(res.body.response.graphs.BOE[0].date).should.equal(moment(date).add('w', -1).day(0)._d.getTime());
          res.body.response.graphs.BOE[0].value.should.equal(0);
          Date.parse(res.body.response.graphs.BOE[1].date).should.equal(moment(date).day(0)._d.getTime());
          res.body.response.graphs.BOE[1].value.should.equal(10.05);
          Date.parse(res.body.response.graphs.BOE[2].date).should.equal(moment(date).add('w', 1).day(0)._d.getTime());
          res.body.response.graphs.BOE[2].value.should.equal(11.00);
          Date.parse(res.body.response.graphs.BOE[3].date).should.equal(moment(date).add('w', 2).day(0)._d.getTime());
          res.body.response.graphs.BOE[3].value.should.equal(11.05);
          Date.parse(res.body.response.graphs.BOE[4].date).should.equal(moment(date).add('w', 3).day(0)._d.getTime());
          res.body.response.graphs.BOE[4].value.should.equal(12.00);
          Date.parse(res.body.response.graphs.BOE[5].date).should.equal(moment(date).add('w', 4).day(0)._d.getTime());
          res.body.response.graphs.BOE[5].value.should.equal(12.05);

          res.body.response.graphs.SickSense.should.be.Array;
          res.body.response.graphs.SickSense.length.should.equal(6);

          Date.parse(res.body.response.graphs.SickSense[0].date).should.equal(moment(date).add('w', -1).day(0)._d.getTime());
          res.body.response.graphs.SickSense[0].value.should.equal(0);
          Date.parse(res.body.response.graphs.SickSense[1].date).should.equal(moment(date).day(0)._d.getTime());
          res.body.response.graphs.SickSense[1].value.should.equal(11.05);
          Date.parse(res.body.response.graphs.SickSense[2].date).should.equal(moment(date).add('w', 1).day(0)._d.getTime());
          res.body.response.graphs.SickSense[2].value.should.equal(12.00);
          Date.parse(res.body.response.graphs.SickSense[3].date).should.equal(moment(date).add('w', 2).day(0)._d.getTime());
          res.body.response.graphs.SickSense[3].value.should.equal(12.05);
          Date.parse(res.body.response.graphs.SickSense[4].date).should.equal(moment(date).add('w', 3).day(0)._d.getTime());
          res.body.response.graphs.SickSense[4].value.should.equal(13.00);
          Date.parse(res.body.response.graphs.SickSense[5].date).should.equal(moment(date).add('w', 4).day(0)._d.getTime());
          res.body.response.graphs.SickSense[5].value.should.equal(13.05);

          res.body.response.topSymptoms.should.be.Array;
          res.body.response.topSymptoms.length.should.equal(2);
          // No significant order if it's the same rank
          res.body.response.topSymptoms[0].name.should.match(/rash|sore\-throat/);
          res.body.response.topSymptoms[0].percentOfReports.should.equal(50);
          res.body.response.topSymptoms[0].numberOfReports.should.equal(1);

          done();
        });
    });
  });
});
