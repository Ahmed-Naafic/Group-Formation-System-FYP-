const Joi = require('joi');

const createSemesterSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'endDate must be after startDate',
  }),
  status: Joi.string().valid('active', 'archived').default('active'),
});

const updateSemesterSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  year: Joi.number().integer().min(2000).max(2100),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  status: Joi.string().valid('active', 'archived'),
}).min(1);

module.exports = { createSemesterSchema, updateSemesterSchema };
