const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const updateAttendanceSchema = Joi.object({
  studentId: objectId.required(),
  attendance: Joi.number().min(0).max(100).required(),
});

// At least one score field must be provided alongside studentId
const updateScoresSchema = Joi.object({
  studentId: objectId.required(),
  midterm: Joi.number().min(0).allow(null),
  final: Joi.number().min(0).allow(null),
  coursework: Joi.number().min(0).allow(null),
}).or('midterm', 'final', 'coursework');

const getAttendanceQuerySchema = Joi.object({
  classId: objectId.required(),
});

module.exports = { updateAttendanceSchema, updateScoresSchema, getAttendanceQuerySchema };
