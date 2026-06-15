const router          = require('express').Router();
const { authenticate }  = require('../../../middleware/auth');
const { requireRole }   = require('../../../middleware/rbac');
const validate          = require('../../../common/validators/validate');
const {
  generateGroupsSchema,
  updateGroupSchema,
  offeringQuerySchema,
  groupParamSchema,
} = require('../validations/groupValidation');
const groupController = require('../controllers/groupController');

router.post(
  '/generate',
  authenticate, requireRole('admin', 'instructor'),
  validate(generateGroupsSchema),
  groupController.generate,
);

router.post(
  '/regenerate',
  authenticate, requireRole('admin', 'instructor'),
  validate(generateGroupsSchema),
  groupController.regenerate,
);

router.delete(
  '/',
  authenticate, requireRole('admin', 'instructor'),
  validate(offeringQuerySchema, 'query'),
  groupController.archiveForOffering,
);

router.get(
  '/',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(offeringQuerySchema, 'query'),
  groupController.getByOffering,
);

router.get(
  '/:id',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(groupParamSchema, 'params'),
  groupController.getById,
);

router.patch(
  '/:id',
  authenticate, requireRole('admin', 'instructor'),
  validate(groupParamSchema, 'params'),
  validate(updateGroupSchema),
  groupController.update,
);

module.exports = router;
