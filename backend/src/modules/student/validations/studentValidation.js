const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const scoresSchema = Joi.object({
  midterm: Joi.number().min(0).allow(null).default(null),
  final: Joi.number().min(0).allow(null).default(null),
  coursework: Joi.number().min(0).allow(null).default(null),
});

const createStudentSchema = Joi.object({
  classId: objectId.required(),
  studentId: Joi.string().trim().min(1).max(50).required(),
  fullName: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email({ tlds: { allow: false } }).allow(null, '').default(null),
  attendance: Joi.number().min(0).max(100).default(0),
  scores: scoresSchema.default({ midterm: null, final: null, coursework: null }),
});

const updateStudentSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100),
  attendance: Joi.number().min(0).max(100),
  scores: scoresSchema,
}).min(1);

const bulkUploadSchema = Joi.object({
  classId: objectId.required().messages({
    'any.required': 'classId is required as a form field',
  }),
});

module.exports = { createStudentSchema, updateStudentSchema, bulkUploadSchema };
