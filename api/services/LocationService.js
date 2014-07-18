var when = require('when');

module.exports = {

  findCityByLatLng: function (latitude, longitude) {
    return when.promise(function (resolve, reject) {

      pg.connect(sails.config.connections.postgresql.connectionString, function (err, client, pgDone) {
        if (err) {
          sails.log.error("ERROR: findCityByLatLng():", err);
          return reject(err);
        }

        var query =
          'SELECT * FROM locations ORDER BY ' +
          'ST_Distance(geom, ST_GeomFromText(\'Point(' + longitude + ' ' + latitude + ')\', 4326)) ' +
          'LIMIT 1';

        client.query(query, [], function (err, result) {
          pgDone();
          if (err) {
            sails.log.error("ERROR: findCityByLatLng():", err);
            return reject(err);
          }

          if (result.rows.length === 0) {
            resolve(false);
          }
          else {
            resolve(result.rows[0]);
          }
        });
      });

    });
  }

};
