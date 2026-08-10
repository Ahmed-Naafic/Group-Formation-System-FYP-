const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

// `name` is intentionally not accepted here — it's always derived server-side
// as the next unused "Semester N" (1-12) within the academic year (see
// semesterService.create / semesterRules.nextSemesterName), so it can't be
// spoofed, mistyped, or duplicated through the API. Any `name` a client sends
// is silently stripped by the `validate` middleware's `stripUnknown: true`.
const createSemesterSchema = Joi.object({
  academicYearId: objectId.required(),
  startDate:      Joi.date().iso().required(),
  endDate:        Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'endDate must be after startDate',
  }),
  status: Joi.string().valid('active', 'completed', 'archived').default('active'),
});

// `name` is immutable after creation — omitted here for the same reason as
// createSemesterSchema above.
const updateSemesterSchema = Joi.object({
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
