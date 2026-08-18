const router = require('express').Router();
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  updateSettingsSchema,
  setCategoryVisibilitySchema,
  studentParamSchema,
  cohortParamSchema,
  updateStudentScoresSchema,
} = require('../validations/performanceValidation');
const performanceController = require('../controllers/performanceController');

router.get(
  '/settings',
  authenticate, requireRole('admin', 'instructor'),
  performanceController.getSettings,
);

router.put(
  '/settings',
  authenticate, requireRole('admin', 'instructor'),
  validate(updateSettingsSchema),
  performanceController.updateSettings,
);

// Admin-only — controls whether instructors get the "Show Category" toggle
// on their pages at all. Separate from the threshold PUT above (which
// admin+instructor can both edit) since this is deliberately admin-only.
router.patch(
  '/settings/category-visibility',
  authenticate, requireRole('admin'),
  validate(setCategoryVisibilitySchema),
  performanceController.setCategoryVisibility,
);

router.post(
  '/recalculate/student/:studentId',
  authenticate, requireRole('admin', 'instructor'),
  validate(studentParamSchema, 'params'),
  performanceController.recalculateStudent,
);

router.post(
  '/recalculate/cohort/:cohortId',
  authenticate, requireRole('admin', 'instructor'),
  validate(cohortParamSchema, 'params'),
  performanceController.recalculateCohort,
);

router.post(
  '/scores',
  authenticate, requireRole('admin', 'instructor'),
  validate(updateStudentScoresSchema),
  performanceController.updateScores,
);

module.exports = router;
