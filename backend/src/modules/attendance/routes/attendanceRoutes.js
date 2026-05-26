const router = require('express').Router();
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  updateAttendanceSchema,
  updateScoresSchema,
  getAttendanceQuerySchema,
} = require('../validations/attendanceValidation');
const attendanceController = require('../controllers/attendanceController');

const guard      = [authenticate, requireRole('admin', 'instructor')];
const adminGuard = [authenticate, requireRole('admin')];

router.get('/attendance',  guard,      validate(getAttendanceQuerySchema, 'query'), attendanceController.getByClass);
router.post('/attendance', guard,      validate(updateAttendanceSchema),            attendanceController.update);
router.post('/scores',     adminGuard, validate(updateScoresSchema),                attendanceController.updateScores);

module.exports = router;
