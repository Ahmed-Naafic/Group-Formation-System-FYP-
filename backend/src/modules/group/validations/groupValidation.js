const Joi       = require('joi');
const objectId  = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({
  'string.pattern.base': '{{#label}} must be a valid ObjectId',
});

// POST /api/groups/generate  and  POST /api/groups/regenerate
const generateGroupsSchema = Joi.object({
  classId:   objectId.required(),
  groupSize: Joi.number().integer().min(3).max(6).default(4),
  options:   Joi.object({
    attendanceThreshold: Joi.number().min(0).max(100).default(25),
  }).default({}),
});

// PATCH /api/groups/:id
const updateGroupSchema = Joi.object({
  leaderId:        objectId,
  addMemberIds:    Joi.array().items(objectId).min(1),
  removeMemberIds: Joi.array().items(objectId).min(1),
}).min(1).messages({
  'object.min': 'Provide at least one of: leaderId, addMemberIds, removeMemberIds',
});

// Query param for GET /api/groups?classId=
const classIdQuerySchema = Joi.object({
  classId: objectId.required(),
});

// Route param :id
const groupParamSchema = Joi.object({
  id: objectId.required(),
});

module.exports = {
  generateGroupsSchema,
  updateGroupSchema,
  classIdQuerySchema,
  groupParamSchema,
};
