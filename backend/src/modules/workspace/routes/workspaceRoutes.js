const { Router }      = require('express');
const { authenticate }  = require('../../../middleware/auth');
const { requireRole }   = require('../../../middleware/rbac');
const Joi               = require('joi');
const validate          = require('../../../common/validators/validate');
const workspaceController = require('../controllers/workspaceController');

const router = Router();

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() });

// Student: list all group workspaces they belong to
router.get('/', authenticate, requireRole('student'), workspaceController.getAll);

// All roles: look up a workspace by group id (must be before /:id to avoid shadowing)
const groupIdParam = Joi.object({ groupId: Joi.string().hex().length(24).required() });
router.get(
  '/by-group/:groupId',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(groupIdParam, 'params'),
  workspaceController.getByGroupId,
);

// All authenticated roles: view a single workspace (service enforces ownership)
router.get(
  '/:id',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(idParam, 'params'),
  workspaceController.getById,
);

module.exports = router;
