const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const promptSchema = Joi.string().trim().min(10).max(1000).required().messages({
  'string.empty': 'Prompt is required',
  'any.required': 'Prompt is required',
  'string.min':   'Prompt must be at least 10 characters',
  'string.max':   'Prompt must be 1000 characters or fewer',
});

const aiValidation = {
  generateTask: Joi.object({
    prompt: promptSchema,
  }),

  generateTaskVariations: Joi.object({
    prompt: promptSchema,
    groupIds: Joi.array().items(objectId).min(1).max(20).required().messages({
      'array.min':    'At least one group is required',
      'array.max':    'Cannot generate variations for more than 20 groups',
      'any.required': 'groupIds is required',
    }),
  }),
};

module.exports = aiValidation;
