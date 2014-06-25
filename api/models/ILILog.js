module.exports = {
  attributes: {
    source: {
      type: 'string',
      required: true
    },

    year: {
      type: 'integer',
      required: true
    },

    week: {
      type: 'integer',
      required: true
    },

    value: {
      type: 'float',
      required: true
    }
  }
};
