const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const submissionValidation = {
  submit: Joi.object({
    fileIds: Joi.array().items(objectId).default([]),
    notes:   Joi.string().trim().max(5000).allow('', null),
  }),

  grade: Joi.object({
    grade: Joi.number().min(0).max(100).required(),
  }),

  taskIdParam: Joi.object({ taskId: objectId.required() }),
  idParam:     Joi.object({ id:     objectId.required() }),
  memberIdParam: Joi.object({ id: objectId.required(), studentId: objectId.required() }),
};

module.exports = submissionValidation;
