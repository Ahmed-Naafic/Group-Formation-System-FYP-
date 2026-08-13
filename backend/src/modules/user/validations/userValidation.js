const Joi = require('joi');
const passwordRules = require('../../../common/validators/passwordRules');

const objectId = Joi.string().hex().length(24);

const createInstructorSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Full name is required',
    'string.min': 'Full name must be at least 2 characters',
  }),
  email:    Joi.string().email({ tlds: { allow: false } }).lowercase().required().messages({
    'any.required': 'Email is required',
    'string.email': 'Email must be a valid email address',
  }),
  password: passwordRules.required(),
  role:     Joi.string().valid('admin', 'instructor').required().messages({
    'any.required': 'Role is required',
    'any.only': 'Role must be either admin or instructor',
  }),
});

const idParamSchema = Joi.object({ id: objectId.required() });

const updateInstructorSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100),
  email:    Joi.string().email({ tlds: { allow: false } }).lowercase(),
  password: passwordRules,
}).min(1).messages({
  'object.min': 'At least one field must be provided to update',
});

module.exports = { createInstructorSchema, idParamSchema, updateInstructorSchema };
