const { Router }          = require('express');
const { authenticate }    = require('../../../middleware/auth');
const { requireRole }     = require('../../../middleware/rbac');
const validate            = require('../../../common/validators/validate');
const submissionController = require('../controllers/submissionController');
const submissionValidation = require('../validations/submissionValidation');

const router = Router();

// GET /api/submissions/:id  — view a single submission
router.get(
  '/:id',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(submissionValidation.idParam, 'params'),
  submissionController.getById,
);

// PATCH /api/submissions/:id/grade  — instructor grades
router.patch(
  '/:id/grade',
  authenticate, requireRole('admin', 'instructor'),
  validate(submissionValidation.idParam, 'params'),
  validate(submissionValidation.grade, 'body'),
  submissionController.grade,
);

module.exports = router;
