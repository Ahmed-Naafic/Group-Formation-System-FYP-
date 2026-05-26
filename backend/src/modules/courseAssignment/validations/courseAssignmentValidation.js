const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createAssignmentSchema = Joi.object({
  classId:      objectId.required(),
  courseId:     objectId.required(),
  instructorId: objectId.required(),
});

const assignmentParamSchema = Joi.object({
  id: objectId.required(),
});

module.exports = { createAssignmentSchema, assignmentParamSchema };
