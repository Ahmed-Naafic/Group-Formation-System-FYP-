const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

// Normalized to uppercase here too (not just at the schema layer) so the
// value in the duplicate-check error message and audit logs already reflects
// what will actually be stored.
const createCohortSchema = Joi.object({
  name:         Joi.string().trim().uppercase().min(1).max(50).required(),
  departmentId: objectId.required(),
  description:  Joi.string().trim().max(500).allow('').default(''),
});

const updateCohortSchema = Joi.object({
  name:        Joi.string().trim().uppercase().min(1).max(50),
  description: Joi.string().trim().max(500).allow(''),
}).min(1);

const idParamSchema = Joi.object({ id: objectId.required() });

module.exports = { createCohortSchema, updateCohortSchema, idParamSchema };
