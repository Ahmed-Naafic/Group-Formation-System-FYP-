const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createStudentSchema = Joi.object({
  classId:      objectId.required(),
  studentId:    Joi.string().trim().min(1).max(50).required(),
  fullName:     Joi.string().trim().min(2).max(100).required(),
  attendance:   Joi.number().min(0).max(100).default(0),
  averageScore: Joi.number().min(0).max(100).allow(null).default(null),
});

const updateStudentSchema = Joi.object({
  fullName:     Joi.string().trim().min(2).max(100),
  attendance:   Joi.number().min(0).max(100),
  averageScore: Joi.number().min(0).max(100).allow(null),
}).min(1);

const bulkUploadSchema = Joi.object({
  classId: objectId.required().messages({
    'any.required': 'classId is required as a form field',
  }),
  // Sent as string 'true'/'false' by multipart/form-data clients
  confirmTransfers: Joi.boolean().truthy('true').falsy('false').sensitive(false).default(false),
});

module.exports = { createStudentSchema, updateStudentSchema, bulkUploadSchema };
