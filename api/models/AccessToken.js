module.exports = {
  attributes: {
    token: {
      type: "string",
      required: true,
      unique: true
    },
    userId: {
      type: "string",
      required: true
    },
    deviceId: {
      type: "string",
      required: false
    },
    expired: "datetime"
  }
};
