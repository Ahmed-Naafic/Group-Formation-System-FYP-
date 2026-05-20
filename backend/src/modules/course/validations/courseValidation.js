const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createCourseSchema = Joi.object({
  departmentId: objectId.required(),
  name: Joi.string().trim().min(2).max(150).required(),
  code: Joi.string().trim().min(2).max(20).uppercase().required(),
  description: Joi.string().trim().max(500).allow('').default(''),
});

const updateCourseSchema = Joi.object({
  departmentId: objectId,
  name: Joi.string().trim().min(2).max(150),
  code: Joi.string().trim().min(2).max(20).uppercase(),
  description: Joi.string().trim().max(500).allow(''),
}).min(1);

module.exports = { createCourseSchema, updateCourseSchema };
