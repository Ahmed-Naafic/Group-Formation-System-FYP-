const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createStudentSchema = Joi.object({
  cohortId:     objectId.required(),
  studentId:    Joi.string().trim().min(1).max(50).required(),
  fullName:     Joi.string().trim().min(2).max(100).required(),
  averageScore: Joi.number().min(0).max(100).allow(null).default(null),
});

const updateStudentSchema = Joi.object({
  fullName:     Joi.string().trim().min(2).max(100),
  averageScore: Joi.number().min(0).max(100).allow(null),
}).min(1);

const clearByCohortSchema = Joi.object({
  cohortId: objectId.required().messages({
    'any.required': 'cohortId is required as a query parameter',
  }),
});

const bulkUploadSchema = Joi.object({
  cohortId: objectId.required().messages({
    'any.required': 'cohortId is required as a form field',
  }),
  confirmTransfers: Joi.boolean().truthy('true').falsy('false').sensitive(false).default(false),
});

module.exports = { createStudentSchema, updateStudentSchema, bulkUploadSchema, clearByCohortSchema };
