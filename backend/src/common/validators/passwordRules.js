const Joi = require('joi');

// Shared password strength rule so every account (student, instructor, admin)
// is held to the same complexity requirement with the same error message.
const passwordRules = Joi.string()
  .min(6)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .messages({
    'string.pattern.base':
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    'string.min': 'Password must be at least 6 characters',
    'string.max': 'Password must be at most 128 characters',
  });

module.exports = passwordRules;
