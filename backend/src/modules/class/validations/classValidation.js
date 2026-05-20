const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createClassSchema = Joi.object({
  courseId: objectId.required(),
  semesterId: objectId.required(),
  name: Joi.string().trim().min(2).max(100).required(),
  instructorId: objectId.allow(null).default(null),
  maxStudents: Joi.number().integer().min(1).allow(null).default(null),
});

const updateClassSchema = Joi.object({
  courseId: objectId,
  semesterId: objectId,
  name: Joi.string().trim().min(2).max(100),
  instructorId: objectId.allow(null),
  maxStudents: Joi.number().integer().min(1).allow(null),
}).min(1);

module.exports = { createClassSchema, updateClassSchema };
