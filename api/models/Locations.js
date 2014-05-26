module.exports = {
  attributes: {
    code: {
      type: "string",
      required: true,
      unique: true
    },
    tambon_th: {
      type: "string",
      required: true
    },
    tambon_en: {
      type: "string",
      required: true
    },
    amphoe_en: {
      type: "string",
      required: true
    },
    amphoe_th: {
      type: "string",
      required: true
    },
    province_en: {
      type: "string",
      required: true
    },
    province_th: {
      type: "string",
      required: true
    },
    latitude:{
      type: "float",
      required: true
    },
    longitude: {
      type: "float",
      required: true
    }
  }
};
