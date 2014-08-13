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
  },

  getLocationByAddress: function (address) {
    return when.promise(function (resolve, reject) {
      pgconnect()
        .then(function (conn) {
          conn.client.query("\
            SELECT * FROM locations \
            WHERE (tambon_en = $1 OR tambon_th = $1) AND \
                  (amphoe_en = $2 OR amphoe_th = $2)  AND \
                  (province_en = $3 OR province_th = $3) \
          ", [ address.subdistrict, address.district, address.city ], function (err, result) {
            conn.done();

            if (err) {
              sails.log.error(err);
              return reject(err);
            }

            if (result.rows.length > 0) {
              resolve(result.rows[0]);
            }
            else {
              reject(new Error("Address not found"));
            }
          });
        })
        .catch(function (err) {
          sails.log.error(err);
          reject(err);
        });
    });
  },

};
