const Joi = require('joi');

const passwordRules = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .messages({
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'string.min': 'Password must be at least 8 characters',
  });

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
