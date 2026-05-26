const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const fileValidation = {
  workspaceId: Joi.object({ workspaceId: objectId.required() }),
  fileId:      Joi.object({ workspaceId: objectId.required(), fileId: objectId.required() }),
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};

module.exports = fileValidation;
