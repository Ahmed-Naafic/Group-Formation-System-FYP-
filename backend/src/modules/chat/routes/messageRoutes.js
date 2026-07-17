const { Router }   = require('express');
const multer       = require('multer');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate         = require('../../../common/validators/validate');
const Joi              = require('joi');
const messageController = require('../controllers/messageController');
const messageValidation = require('../validations/messageValidation');
const { BadRequestError } = require('../../../common/errors');
const { ALLOWED_AUDIO_MIME_TYPES, MAX_AUDIO_FILE_SIZE } = messageValidation;

const router = Router({ mergeParams: true }); // picks up :workspaceId from parent

const objectId = Joi.string().hex().length(24);
const wsParam  = Joi.object({ workspaceId: objectId.required() });
const msgParam = Joi.object({ workspaceId: objectId.required(), messageId: objectId.required() });

// Multer: memory storage so StorageService controls where/how the audio blob lands,
// same pattern as the file module's upload route.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_AUDIO_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestError(`Audio type '${file.mimetype}' is not allowed`));
  },
});

// All chat endpoints require authentication; admin may read but not send (enforced in service)
router.use(authenticate, requireRole('admin', 'instructor', 'student'));

router.get(
  '/',
  validate(wsParam, 'params'),
  validate(messageValidation.listMessages, 'query'),
  messageController.list,
);

router.post(
  '/',
  validate(wsParam, 'params'),
  validate(messageValidation.sendMessage, 'body'),
  messageController.send,
);

// Multer must run before Joi validates req.body — for multipart requests,
// multer is what populates req.body in the first place.
router.post(
  '/voice',
  validate(wsParam, 'params'),
  upload.single('audio'),
  validate(messageValidation.sendVoiceMessage, 'body'),
  messageController.sendVoice,
);

router.get(
  '/:messageId/audio',
  validate(msgParam, 'params'),
  messageController.audio,
);

router.post(
  '/read-all',
  validate(wsParam, 'params'),
  messageController.markAllRead,
);

router.patch(
  '/:messageId/read',
  validate(msgParam, 'params'),
  messageController.markRead,
);

router.delete(
  '/:messageId',
  validate(msgParam, 'params'),
  messageController.remove,
);

router.post(
  '/:messageId/react',
  validate(msgParam, 'params'),
  validate(messageValidation.react, 'body'),
  messageController.react,
);

module.exports = router;
