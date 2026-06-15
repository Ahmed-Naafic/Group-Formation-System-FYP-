const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createAcademicYearSchema = Joi.object({
  name:      Joi.string().trim().min(1).max(20).required(),
  startDate: Joi.date().required(),
  endDate:   Joi.date().required(),
  status:    Joi.string().valid('active', 'completed', 'archived').default('active'),
});

const updateAcademicYearSchema = Joi.object({
  name:      Joi.string().trim().min(1).max(20),
  startDate: Joi.date(),
  endDate:   Joi.date(),
  status:    Joi.string().valid('active', 'completed', 'archived'),
}).min(1);

const idParamSchema = Joi.object({ id: objectId.required() });

module.exports = { createAcademicYearSchema, updateAcademicYearSchema, idParamSchema };
