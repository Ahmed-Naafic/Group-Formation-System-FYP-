const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

// code is server-generated (see courseCodeGenerator) — never accepted from the client.
const createCourseSchema = Joi.object({
  departmentId: objectId.required(),
  name: Joi.string().trim().min(2).max(150).required(),
  description: Joi.string().trim().max(500).allow('').default(''),
});

const updateCourseSchema = Joi.object({
  departmentId: objectId,
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().max(500).allow(''),
}).min(1);

module.exports = { createCourseSchema, updateCourseSchema };
