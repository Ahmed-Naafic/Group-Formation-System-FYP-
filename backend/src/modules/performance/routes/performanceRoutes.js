const router = require('express').Router();
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  updateSettingsSchema,
  studentParamSchema,
  classParamSchema,
  updateStudentAttendanceSchema,
  updateStudentScoresSchema,
} = require('../validations/performanceValidation');
const performanceController = require('../controllers/performanceController');

router.get(
  '/settings',
  authenticate, requireRole('admin', 'instructor'),
  performanceController.getSettings
);

router.put(
  '/settings',
  authenticate, requireRole('admin'),
  validate(updateSettingsSchema),
  performanceController.updateSettings
);

router.post(
  '/recalculate/student/:studentId',
  authenticate, requireRole('admin', 'instructor'),
  validate(studentParamSchema, 'params'),
  performanceController.recalculateStudent
);

router.post(
  '/recalculate/class/:classId',
  authenticate, requireRole('admin', 'instructor'),
  validate(classParamSchema, 'params'),
  performanceController.recalculateClass
);

router.post(
  '/attendance',
  authenticate, requireRole('admin', 'instructor'),
  validate(updateStudentAttendanceSchema),
  performanceController.updateAttendance,
);

router.post(
  '/scores',
  authenticate, requireRole('admin', 'instructor'),
  validate(updateStudentScoresSchema),
  performanceController.updateScores,
);

module.exports = router;
