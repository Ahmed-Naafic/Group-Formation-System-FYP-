const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const updateAttendanceSchema = Joi.object({
  studentId:  objectId.required(),
  attendance: Joi.number().min(0).max(100).required(),
});

const updateScoresSchema = Joi.object({
  studentId:    objectId.required(),
  averageScore: Joi.number().min(0).max(100).allow(null).required(),
});

const getAttendanceQuerySchema = Joi.object({
  classId: objectId.required(),
});

module.exports = { updateAttendanceSchema, updateScoresSchema, getAttendanceQuerySchema };
