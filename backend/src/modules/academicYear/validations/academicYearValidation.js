const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createAcademicYearSchema = Joi.object({
  name:      Joi.string().trim().min(1).max(20).required(),
  startDate: Joi.date().iso().required(),
  endDate:   Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'endDate must be after startDate',
  }),
  status:    Joi.string().valid('active', 'completed', 'archived').default('active'),
});

// endDate > startDate cross-field check is enforced in the service for updates
// (either field can be omitted, so we can't do it purely in Joi).
const updateAcademicYearSchema = Joi.object({
  name:      Joi.string().trim().min(1).max(20),
  startDate: Joi.date().iso(),
  endDate:   Joi.date().iso(),
  status:    Joi.string().valid('active', 'completed', 'archived'),
}).min(1);

const idParamSchema = Joi.object({ id: objectId.required() });

module.exports = { createAcademicYearSchema, updateAcademicYearSchema, idParamSchema };
