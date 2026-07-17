const Joi = require('joi');

const aiValidation = {
  generateTask: Joi.object({
    prompt: Joi.string().trim().min(10).max(1000).required().messages({
      'string.empty': 'Prompt is required',
      'any.required': 'Prompt is required',
      'string.min':   'Prompt must be at least 10 characters',
      'string.max':   'Prompt must be 1000 characters or fewer',
    }),
  }),
};

module.exports = aiValidation;
