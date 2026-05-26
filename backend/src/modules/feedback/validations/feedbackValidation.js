const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const feedbackValidation = {
  submitFeedback: Joi.object({
    groupId:   objectId.required(),
    taskId:    objectId.allow(null, ''),
    toUserId:  objectId.allow(null, ''),
    toGroupId: objectId.allow(null, ''),
    rating:    Joi.number().integer().min(1).max(5).required(),
    comment:   Joi.string().trim().max(2000).allow('', null),
  }),

  listFeedback: Joi.object({
    groupId: objectId.required(),
    taskId:  objectId,
  }),
};

module.exports = feedbackValidation;
