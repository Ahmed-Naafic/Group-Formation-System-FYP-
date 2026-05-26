const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const updateSettingsSchema = Joi.object({
  thresholds: Joi.object({
    high:   Joi.number().min(0).max(100).required(),
    medium: Joi.number().min(0).max(100).required(),
  })
    .required()
    .custom((value, helpers) => {
      if (value.medium >= value.high) {
        return helpers.message('thresholds.medium must be less than thresholds.high');
      }
      return value;
    }),
});

const studentParamSchema = Joi.object({
  studentId: objectId.required(),
});

const classParamSchema = Joi.object({
  classId: objectId.required(),
});

module.exports = { updateSettingsSchema, studentParamSchema, classParamSchema };
