// var password = require('password-hash-and-salt');

module.exports = {
  types: {
    gender: function(gender) {
      return _.contains(['male', 'female'], gender);
    },
    CE: function(year) {
      return 1900 < year && year < (new Date()).getUTCFullYear();
    },
    latitude: function(latitude) {
      return -90.0 < latitude && latitude < 90.0;
    },
    longitude: function(longitude) {
      return -180.0 < longitude && longitude < 180.0;
    },
    GeoJSONPoint: function(point) {
      return point.type && point.type == 'Point' &&
             point.coordinates &&
             typeof(point.coordinates[0]) === 'number' &&
             typeof(point.coordinates[1]) === 'number' &&
             (point.coordinates[0] > -180.0) && (point.coordinates[0] < 180.0) &&
             (point.coordinates[1] >  -90.0) && (point.coordinates[1] <  90.0);
    }
  },

  autoPK: true,

  attributes: {
    email: {
      type: "email",
      unique: true
    },
    password: "string",
    tel: "string",
    gender: {
      type: "string",
      gender: true
    },
    birthYear: {
      type: "integer",
      CE: true
    },

    subdistrict: "string",
    district: "string",
    city: "string",

    latitude: {
      type: "float",
      latitude: true
    },
    longitude: {
      type: "float",
      longitude: true
    },

    address: function() {
      return {
        subdistrict: this.subdistrict,
        district: this.district,
        city: this.city
      };
    },

    toJSON: function() {
      return {
        id: this.id.toString(),
        email: this.email,
        tel: this.tel,
        gender: this.gender,
        birthYear: this.birthYear,
        address: this.address(),
        location: {
          longitude: this.longitude,
          latitude: this.latitude
        }
      };
    }
  }
};
