const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const updateSettingsSchema = Joi.object({
  maxMarks: Joi.object({
    midterm:    Joi.number().min(1).required(),
    final:      Joi.number().min(1).required(),
    coursework: Joi.number().min(1).required(),
  }).required(),

  weights: Joi.object({
    midterm:    Joi.number().min(0).max(1).required(),
    final:      Joi.number().min(0).max(1).required(),
    coursework: Joi.number().min(0).max(1).required(),
  })
    .required()
    .custom((value, helpers) => {
      const sum = value.midterm + value.final + value.coursework;
      if (Math.abs(sum - 1.0) > 0.001) {
        return helpers.message('weights.midterm + weights.final + weights.coursework must equal 1.0');
      }
      return value;
    }),

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
