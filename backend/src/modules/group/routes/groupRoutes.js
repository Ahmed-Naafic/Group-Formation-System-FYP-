const router          = require('express').Router();
const { authenticate }  = require('../../../middleware/auth');
const { requireRole }   = require('../../../middleware/rbac');
const validate          = require('../../../common/validators/validate');
const {
  generateGroupsSchema,
  updateGroupSchema,
  classIdQuerySchema,
  groupParamSchema,
} = require('../validations/groupValidation');
const groupController = require('../controllers/groupController');

// Generate groups for a class (fails if active groups already exist)
router.post(
  '/generate',
  authenticate, requireRole('admin', 'instructor'),
  validate(generateGroupsSchema),
  groupController.generate,
);

// Regenerate — archives current groups, produces a new balanced set
router.post(
  '/regenerate',
  authenticate, requireRole('admin', 'instructor'),
  validate(generateGroupsSchema),
  groupController.regenerate,
);

// List groups for a class (students see only their own group)
router.get(
  '/',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(classIdQuerySchema, 'query'),
  groupController.getByClass,
);

// Get a single group
router.get(
  '/:id',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(groupParamSchema, 'params'),
  groupController.getById,
);

// Manual adjustment: change leader, add/remove members
router.patch(
  '/:id',
  authenticate, requireRole('admin', 'instructor'),
  validate(groupParamSchema, 'params'),
  validate(updateGroupSchema),
  groupController.update,
);

module.exports = router;
