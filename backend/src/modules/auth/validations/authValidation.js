const Joi = require('joi');
const passwordRules = require('../../../common/validators/passwordRules');

const loginSchema = Joi.object({
  identifier: Joi.string().trim().required().messages({
    'any.required': 'Email or Student ID is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

// currentPassword is optional — omitted when token scope is 'change_password' (forced change)
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string(),
  newPassword: passwordRules.required(),
});

module.exports = { loginSchema, changePasswordSchema };
