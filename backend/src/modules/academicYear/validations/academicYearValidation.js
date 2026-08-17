const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

// name and status are intentionally NOT accepted here — name is always
// server-derived from startDate (academicYearRules.deriveName) and status is
// always computed live (academicYearRules.computeEffectiveStatus). The
// `validate` middleware runs Joi with stripUnknown: true, so if a caller
// sends either field directly against the API it is silently dropped rather
// than trusted — the server's own derivation always wins.
const createAcademicYearSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate:   Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'endDate must be after startDate',
  }),
});

// endDate > startDate cross-field check (when only one is supplied) is
// enforced in the service, same reasoning as semesters.
const updateAcademicYearSchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate:   Joi.date().iso(),
}).min(1);

const idParamSchema = Joi.object({ id: objectId.required() });

module.exports = { createAcademicYearSchema, updateAcademicYearSchema, idParamSchema };
