const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createInstructorSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  email:    Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().min(6).max(100).required(),
  role:     Joi.string().valid('admin', 'instructor').required(),
});

const idParamSchema = Joi.object({ id: objectId.required() });

const updateInstructorSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100),
  email:    Joi.string().email({ tlds: { allow: false } }).lowercase(),
  password: Joi.string().min(6).max(100),
}).min(1);

module.exports = { createInstructorSchema, idParamSchema, updateInstructorSchema };
