var pg = require('pg');
var when = require('when');
var wkt = require('terraformer-wkt-parser');
var passgen = require('password-hash-and-salt');
var Faker = require('Faker');
var rack = require('hat').rack(512, 36);
require('date-utils');

function clearUsers() {
  return when.promise(function(resolve, reject) {
    pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
      if (err) return reject(err);
      client.query('DELETE FROM users', [], function(err, result) {
        pgDone();

        if (err) return reject(err);
        resolve();
      });
    });
  });
}

function clearAccessTokens() {
  return when.promise(function(resolve, reject) {
    AccessToken.destroy().exec(function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function createUser(values, generateAccessToken) {
  values = values || {};

  return when.promise(function(resolve, reject) {
    var fakeEmail = Faker.Internet.email();
    var fakeLatitude = Faker.Address.latitude();
    var fakeLongitude = Faker.Address.longitude();

    passgen(values.password || fakeEmail).hash(sails.config.session.secret, function(err, hashedPassword) {
      var _values = [
        values.email || fakeEmail,
        hashedPassword,
        values.tel || Faker.PhoneNumber.phoneNumber(),
        values.gender || "male",
        values.birthYear || _.random(1900, 2014),
        values.subdistrict || "Samsen Nok",
        values.district || "Huai Khwang",
        values.city || "Bangkok",
        values.latitude || fakeLatitude,
        values.longitude || fakeLongitude,
        'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            values.latitude || fakeLatitude,
            values.longitude || fakeLongitude
          ]
        }),
        values.createdAt || new Date(),
        values.updatedAt || new Date()
      ];

      pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
        if (err) return reject(err);

        var query = '\
          INSERT \
          INTO "users" \
          ("email", "password", "tel", "gender", "birthYear", "subdistrict", \
               "district", "city", "latitude", "longitude", "geom", "createdAt", "updatedAt" \
          ) \
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *';

        client.query(query, _values, function(err, result) {
          pgDone();

          if (err) return reject(err);

          var user = result.rows[0];

          if (generateAccessToken) {
            AccessToken.create({
              token: rack(),
              userId: user.id,
              expired: (new Date()).addDays(30)
            }).exec(function(err, accessToken) {
              user.accessToken = accessToken.token;
              resolve(user);
            });
          }
          else {
            resolve(user);
          }
        });
      });
    });
  });
}

function createReport (values) {
  values = values || {};

  values.isFine = _.isEmpty(values.symptoms);

  values.address = _.extend({
    subdistrict: "Samsen Nok",
    district: "Huai Khwang",
    city: "Bangkok"
  }, values.address);

  values.locationByAddress = _.extend({
    latitude: 13.781730,
    longitude: 100.545357
  }, values.locationByAddress);

  var fakeLatitude = Faker.Address.latitude();
  var fakeLongitude = Faker.Address.longitude();

  values.location = _.extend({
    latitude: fakeLatitude,
    longitude: fakeLongitude
  }, values.location);

  values.locationByAddress.latitude = values.locationByAddress.latitude || latitude;
  values.locationByAddress.longitude = values.locationByAddress.longitude || longitude;

  values.startedAt = new Date(values.startedAt || new Date());
  values.createdAt = new Date(values.createdAt || new Date());
  values.updatedAt = new Date(values.updatedAt || new Date());
  values.moreInfo = values.moreInfo || Faker.Lorem.paragraph();

  return ReportService.loadLocationByAddress(values.address)
    .then(function (location) {
      values.location_id = location.id;
      return ReportService.create(values);
    });
}

function _createReport (values) {
  values = values || {};

  values.isFine = _.isEmpty(values.symptoms);

  values.address = _.extend({
    subdistrict: "Samsen Nok",
    district: "Huai Khwang",
    city: "Bangkok"
  }, values.address);

  values.locationByAddress = _.extend({
    latitude: 13.781730,
    longitude: 100.545357
  }, values.locationByAddress);

  return when.promise(function(resolve, reject) {
    var fakeLatitude = Faker.Address.latitude();
    var fakeLongitude = Faker.Address.longitude();

    var latitude = parseFloat((values.location && values.location.latitude) || fakeLatitude);
    var longitude = parseFloat((values.location && values.location.longitude) || fakeLongitude);

    pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(error);
      }

      var year = moment(values.startedAt).year();
      var week = moment(values.startedAt).week();
      var isILI;
      if (typeof values.isILI == 'undefined') {
        isILI = !_.isEmpty(_.intersection(sails.config.symptoms.ILISymptoms, values.symptoms));
      }

      var preparedValues = [
        _.isEmpty(values.symptoms),
        Boolean(values.animalContact),
        new Date(values.startedAt || new Date()),
        year,
        week,
        values.location_id,
        values.address.subdistrict,
        values.address.district,
        values.address.city,
        values.locationByAddress.latitude || latitude,
        values.locationByAddress.longitude || longitude,

        latitude,
        longitude,
        'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            longitude,
            latitude
          ]
        }),
        values.moreInfo || Faker.Lorem.paragraph(),
        values.userId,
        isILI,
        values.createdAt || new Date(),
        values.updatedAt || new Date()
      ];

      client.query('\
        INSERT\
        INTO reports\
          ("isFine", "animalContact", "startedAt", "year", "week", "location_id", "subdistrict", "district", "city", \
           "addressLatitude", "addressLongitude", "latitude", "longitude", "geom", \
           "moreInfo", "userId", "isILI", "createdAt", "updatedAt")\
        VALUES\
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING * \
      ', preparedValues, function(err, result) {
        pgDone();

        if (err) {
          sails.log.error(err);
          var error = new Error("Could not perform your request");
          error.statusCode = 500;
          return reject(error);
        }

        var report = result.rows[0];

        values.symptoms = values.symptoms || [];

        ReportService.saveSymptoms(report, values.symptoms)
          .then(function() {
            resolve(report);
          })
          .catch(function(err) {
            reject(err);
          });
      });
    });

  });
}

function clearReports () {
  return when.promise(function(resolve, reject) {
    pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
      if (err) return reject(err);

      client.query('DELETE FROM reports', [], function(err, result) {
        pgDone();

        if (err) return reject(err);
        resolve();
      });
    });
  });
}

function clearSymptoms () {
  return when.promise(function(resolve, reject) {
    Symptoms.destroy().exec(function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function clearReportsSymptoms () {
  return when.promise(function(resolve, reject) {
    pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
      if (err) return reject(err);

      client.query('DELETE FROM reportssymptoms', [], function(err, result) {
        pgDone();

        if (err) return reject(err);
        resolve();
      });
    });
  });
}

function clearReportsSummaryByWeek () {
  return when.promise(function(resolve, reject) {
    pg.connect(sails.config.connections.postgresql, function(err, client, pgDone) {
      if (err) return reject(err);

      client.query('DELETE FROM reports_summary_by_week', [], function(err, result) {
        pgDone();

        if (err) return reject(err);
        resolve();
      });
    });
  });
}

function clearAll () {
  return clearUsers()
    .then(clearAccessTokens)
    .then(clearSymptoms)
    .then(clearReports)
    .then(clearReportsSymptoms)
    .then(clearReportsSummaryByWeek);
}

module.exports = global.TestHelper = {
  createUser: createUser,
  createReport: createReport,
  clearUsers: clearUsers,
  clearAccessTokens: clearAccessTokens,
  clearSymptoms: clearSymptoms,
  clearReportsSymptoms: clearReportsSymptoms,
  clearReportsSummaryByWeek: clearReportsSummaryByWeek,
  clearReports: clearReports,
  clearAll: clearAll
};
