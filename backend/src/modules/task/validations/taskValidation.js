const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const taskValidation = {
  createTask: Joi.object({
    courseOfferingId:  objectId.required(),
    title:             Joi.string().trim().min(1).max(200).required(),
    description:       Joi.string().trim().max(5000).allow('', null),
    deadline:          Joi.date().iso().allow(null),
    assignedGroupIds:  Joi.array().items(objectId).default([]),
  }),

  updateTask: Joi.object({
    title:          Joi.string().trim().min(1).max(200),
    description:    Joi.string().trim().max(5000).allow('', null),
    deadline:       Joi.date().iso().allow(null),
    status:         Joi.string().valid('open', 'closed'),
    assignedGroups: Joi.array().items(objectId),
  }).min(1),

  listTasks: Joi.object({
    courseOfferingId: objectId.required(),
  }),

  idParam: Joi.object({ id: objectId.required() }),
};

module.exports = taskValidation;
