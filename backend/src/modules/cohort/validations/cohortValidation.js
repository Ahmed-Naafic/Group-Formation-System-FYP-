const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createCohortSchema = Joi.object({
  name:         Joi.string().trim().min(1).max(50).required(),
  departmentId: objectId.required(),
  yearOfEntry:  Joi.number().integer().min(1950).max(2100).allow(null).default(null),
  description:  Joi.string().trim().max(500).allow('').default(''),
});

const updateCohortSchema = Joi.object({
  name:        Joi.string().trim().min(1).max(50),
  yearOfEntry: Joi.number().integer().min(1950).max(2100).allow(null),
  description: Joi.string().trim().max(500).allow(''),
}).min(1);

const idParamSchema = Joi.object({ id: objectId.required() });

module.exports = { createCohortSchema, updateCohortSchema, idParamSchema };
