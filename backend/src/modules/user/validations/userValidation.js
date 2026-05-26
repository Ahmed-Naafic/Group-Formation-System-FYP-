const Joi = require('joi');

const createInstructorSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  email:    Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().min(6).max(100).required(),
});

module.exports = { createInstructorSchema };
