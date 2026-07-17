const { Router }       = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate         = require('../../../common/validators/validate');
const aiController     = require('../controllers/aiController');
const aiValidation     = require('../validations/aiValidation');

const router = Router();

router.post(
  '/generate-task',
  authenticate, requireRole('admin', 'instructor'),
  validate(aiValidation.generateTask, 'body'),
  aiController.generateTask,
);

router.post(
  '/generate-task-variations',
  authenticate, requireRole('admin', 'instructor'),
  validate(aiValidation.generateTaskVariations, 'body'),
  aiController.generateTaskVariations,
);

module.exports = router;
