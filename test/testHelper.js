var pg = require('pg');
var when = require('when');
var wkt = require('terraformer-wkt-parser');
var passgen = require('password-hash-and-salt');
var Faker = require('Faker');
var rack = require('hat').rack(512, 36);
require('date-utils');

function clearUsers() {
  return when.promise(function(resolve, reject) {
    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
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
        values.subdistrict || "Samsen-Nok",
        values.district || "Huay Kwang",
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

      pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
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

  return when.promise(function(resolve, reject) {
    var fakeLatitude = Faker.Address.latitude();
    var fakeLongitude = Faker.Address.longitude();

    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
      if (err) {
        sails.log.error(err);
        var error = new Error("Could not connect to database");
        error.statusCode = 500;
        return reject(error);
      }

      var preparedValues = [
        _.isEmpty(values.symptoms),
        Boolean(values.animalContact),
        new Date(values.startedAt || new Date()),
        parseFloat((values.location && values.location.latitude) || fakeLatitude),
        parseFloat((values.location && values.location.longitude) || fakeLongitude),
        'SRID=4326;' + wkt.convert({
          type: "Point",
          coordinates: [
            parseFloat((values.location && values.location.longitude) || fakeLongitude),
            parseFloat((values.location && values.location.latitude) || fakeLatitude)
          ]
        }),
        values.moreInfo || Faker.Lorem.paragraph(),
        values.userId,
        values.createdAt || new Date(),
        values.updatedAt || new Date()
      ];

      client.query('\
        INSERT\
        INTO reports\
          ("isFine", "animalContact", "startedAt", "latitude", "longitude", "geom", "moreInfo", "userId", "createdAt", "updatedAt")\
        VALUES\
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * \
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
    pg.connect(sails.config.connections.postgresql.connectionString, function(err, client, pgDone) {
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
    ReportsSymptoms.destroy().exec(function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function clearAll () {
  return clearUsers()
    .then(clearAccessTokens)
    .then(clearSymptoms)
    .then(clearReports)
    .then(clearReportsSymptoms);
}

global.TestHelper = {
  createUser: createUser,
  createReport: createReport,
  clearUsers: clearUsers,
  clearAccessTokens: clearAccessTokens,
  clearSymptoms: clearSymptoms,
  clearReportsSymptoms: clearReportsSymptoms,
  clearReports: clearReports,
  clearAll: clearAll
};
