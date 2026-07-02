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
  // Cross-field check: if startDate is also in the payload, endDate must come after it.
  // Service-level check covers the case where only one of the two dates is updated.
  endDate: Joi.date().iso().when('startDate', {
    is:   Joi.date().exist(),
    then: Joi.date().greater(Joi.ref('startDate')).messages({
      'date.greater': 'endDate must be after startDate',
    }),
  }),
  status: Joi.string().valid('active', 'completed', 'archived'),
}).min(1);

const idParamSchema  = Joi.object({ id: objectId.required() });
const listQuerySchema = Joi.object({
  status: Joi.string().valid('active', 'completed', 'archived'),
});

module.exports = { createSemesterSchema, updateSemesterSchema, idParamSchema, listQuerySchema };
