const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createDepartmentSchema = Joi.object({
  facultyId: objectId.required(),
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).allow('').default(''),
});

const updateDepartmentSchema = Joi.object({
  facultyId: objectId,
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(500).allow(''),
}).min(1);

module.exports = { createDepartmentSchema, updateDepartmentSchema };
