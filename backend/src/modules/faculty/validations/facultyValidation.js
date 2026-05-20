const Joi = require('joi');

const createFacultySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).allow('').default(''),
});

const updateFacultySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(500).allow(''),
}).min(1);

module.exports = { createFacultySchema, updateFacultySchema };
