const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const createClassSchema = Joi.object({
  courseIds: Joi.array().items(objectId).min(1).required(),
  semesterId: objectId.required(),
  name: Joi.string().trim().min(2).max(100).required(),
  maxStudents: Joi.number().integer().min(1).allow(null).default(null),
});

const updateClassSchema = Joi.object({
  courseIds: Joi.array().items(objectId).min(1),
  semesterId: objectId,
  name: Joi.string().trim().min(2).max(100),
  maxStudents: Joi.number().integer().min(1).allow(null),
}).min(1);

module.exports = { createClassSchema, updateClassSchema };
