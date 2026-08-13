const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac',
  'audio/webm', 'audio/wav', 'audio/mpeg',
];

const MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — generous headroom over a 3-minute AAC recording
const MAX_AUDIO_DURATION_SECONDS = 180; // 3 minutes
const MAX_ATTACHMENT_FILE_SIZE = 50 * 1024 * 1024; // 50 MB — bigger than the general 20 MB file limit, to fit short videos

const messageValidation = {
  listMessages: Joi.object({
    limit:  Joi.number().integer().min(1).max(100).default(50),
    before: objectId,
    after:  objectId,
  }),

  sendMessage: Joi.object({
    content:    Joi.string().trim().min(1).max(4000).required(),
    replyToId:  objectId.allow(null),
  }),

  sendVoiceMessage: Joi.object({
    duration: Joi.number().integer().positive().max(MAX_AUDIO_DURATION_SECONDS).required().messages({
      'number.base':     'Duration is required',
      'any.required':    'Duration is required',
      'number.max':      `Voice messages cannot exceed ${MAX_AUDIO_DURATION_SECONDS} seconds`,
      'number.positive': 'Duration must be a positive number',
    }),
    replyToId: objectId.allow(null),
  }),

  sendAttachment: Joi.object({
    caption:   Joi.string().trim().max(4000).allow('', null),
    replyToId: objectId.allow(null),
  }),

  react: Joi.object({
    emoji: Joi.string().trim().min(1).max(8).required().messages({
      'string.empty': 'Emoji is required',
      'any.required': 'Emoji is required',
    }),
  }),

  markRead: Joi.object({
    workspaceId: objectId.required(),
    messageId:   objectId.required(),
  }),

  ALLOWED_AUDIO_MIME_TYPES,
  MAX_AUDIO_FILE_SIZE,
  MAX_AUDIO_DURATION_SECONDS,
  MAX_ATTACHMENT_FILE_SIZE,
};

module.exports = messageValidation;
