const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createSemesterSchema = Joi.object({
  name:           Joi.string().trim().min(2).max(100).required(),
  academicYearId: objectId.required(),
  startDate:      Joi.date().iso().required(),
  endDate:        Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'endDate must be after startDate',
  }),
  status: Joi.string().valid('active', 'completed', 'archived').default('active'),
});

const updateSemesterSchema = Joi.object({
  name:           Joi.string().trim().min(2).max(100),
  academicYearId: objectId,
  startDate:      Joi.date().iso(),
  endDate:        Joi.date().iso(),
  status:         Joi.string().valid('active', 'completed', 'archived'),
}).min(1);

module.exports = { createSemesterSchema, updateSemesterSchema };
