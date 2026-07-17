const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const taskValidation = {
  createTask: Joi.object({
    courseOfferingId:  objectId.required().messages({
      'any.required': 'Course offering is required',
      'string.length': 'Invalid course offering ID',
    }),
    title:             Joi.string().trim().min(1).max(200).required().messages({
      'string.empty':  'Title is required',
      'any.required':  'Title is required',
      'string.max':    'Title must be 200 characters or fewer',
    }),
    description:       Joi.string().trim().max(5000).allow('', null).messages({
      'string.max': 'Description must be 5000 characters or fewer',
    }),
    deadline:          Joi.date().iso().greater('now').required().messages({
      'date.base':     'Deadline must be a valid date',
      'date.format':   'Deadline must be a valid date',
      'date.greater':  'Deadline must be in the future',
      'any.required':  'Deadline is required',
    }),
    assignedGroupIds:  Joi.array().items(objectId).default([]),
    submissionType:    Joi.string().valid('group', 'individual').default('group'),
  }),

  // On update, deadline can be freely adjusted (extend, retract, or null-out).
  updateTask: Joi.object({
    title:          Joi.string().trim().min(1).max(200),
    description:    Joi.string().trim().max(5000).allow('', null),
    deadline:       Joi.date().iso().allow(null),
    status:         Joi.string().valid('open', 'closed'),
    assignedGroups: Joi.array().items(objectId),
    submissionType: Joi.string().valid('group', 'individual'),
  }).min(1),

  listTasks: Joi.object({
    courseOfferingId: objectId.required(),
  }),

  idParam: Joi.object({ id: objectId.required() }),

  bulkCreate: Joi.object({
    deadlineAt: Joi.date().iso().greater('now').required().messages({
      'date.base':    'Deadline must be a valid date',
      'date.format':  'Deadline must be a valid date',
      'date.greater': 'Deadline must be in the future',
      'any.required': 'Deadline is required',
    }),
    tasks: Joi.array().items(
      Joi.object({
        groupId:     objectId.required(),
        title:       Joi.string().trim().min(1).max(200).required().messages({
          'string.empty': 'Title is required',
          'any.required': 'Title is required',
          'string.max':   'Title must be 200 characters or fewer',
        }),
        description: Joi.string().trim().max(5000).allow('', null),
      }),
    ).min(1).max(20).required().messages({
      'array.min':    'At least one task is required',
      'array.max':    'Cannot create more than 20 tasks at once',
      'any.required': 'tasks is required',
    }),
  }),
};

module.exports = taskValidation;
