const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

// Max = current year + 1: setting up next year's intake is valid; anything beyond is a typo.
const yearOfEntryRule = Joi.number()
  .integer()
  .min(2015)
  .custom((value, helpers) => {
    const maxYear = new Date().getFullYear() + 1;
    if (value > maxYear) {
      return helpers.error('number.max', { limit: maxYear });
    }
    return value;
  })
  .messages({ 'number.max': `yearOfEntry must not be more than 1 year in the future` });

const createCohortSchema = Joi.object({
  name:         Joi.string().trim().min(1).max(50).required(),
  departmentId: objectId.required(),
  yearOfEntry:  yearOfEntryRule.allow(null).default(null),
  description:  Joi.string().trim().max(500).allow('').default(''),
});

const updateCohortSchema = Joi.object({
  name:        Joi.string().trim().min(1).max(50),
  yearOfEntry: yearOfEntryRule.allow(null),
  description: Joi.string().trim().max(500).allow(''),
}).min(1);

const idParamSchema = Joi.object({ id: objectId.required() });

module.exports = { createCohortSchema, updateCohortSchema, idParamSchema };
