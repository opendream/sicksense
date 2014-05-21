var pg = require('pg');
var when = require('when');
var wkt = require('terraformer-wkt-parser');
var passgen = require('password-hash-and-salt');
var Faker = require('Faker');

global.clearUsers = function clearUsers() {
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
};

global.clearAccessTokens = function clearAccessTokens() {
  return when.promise(function(resolve, reject) {
    AccessToken.destroy().exec(function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

global.createUser = function createUser(values) {
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
          resolve(result.rows[0]);
        });
      });
    });
  });
};
