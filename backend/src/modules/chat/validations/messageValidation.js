const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const messageValidation = {
  listMessages: Joi.object({
    limit:  Joi.number().integer().min(1).max(100).default(50),
    before: objectId,
  }),

  sendMessage: Joi.object({
    content: Joi.string().trim().min(1).max(4000).required(),
  }),

  markRead: Joi.object({
    workspaceId: objectId.required(),
    messageId:   objectId.required(),
  }),
};

module.exports = messageValidation;
