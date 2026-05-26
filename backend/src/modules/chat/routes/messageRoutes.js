const { Router }   = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate         = require('../../../common/validators/validate');
const Joi              = require('joi');
const messageController = require('../controllers/messageController');
const messageValidation = require('../validations/messageValidation');

const router = Router({ mergeParams: true }); // picks up :workspaceId from parent

const objectId = Joi.string().hex().length(24);
const wsParam  = Joi.object({ workspaceId: objectId.required() });
const msgParam = Joi.object({ workspaceId: objectId.required(), messageId: objectId.required() });

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

module.exports = router;
