const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  createAttendanceSchema,
  updateAttendanceSchema,
  bulkUpsertSchema,
  idParamSchema,
  offeringQuerySchema,
} = require('../validations/attendanceValidation');
const attendanceController = require('../controllers/attendanceController');

const router = Router();

const guard      = [authenticate, requireRole('admin', 'instructor')];
const adminGuard = [authenticate, requireRole('admin')];

router.get('/',      ...guard, validate(offeringQuerySchema, 'query'), attendanceController.getByOffering);
router.post('/',     ...guard, validate(createAttendanceSchema),        attendanceController.create);
router.post('/bulk', ...guard, validate(bulkUpsertSchema),              attendanceController.bulkUpsert);
router.patch('/:id', ...guard, validate(idParamSchema, 'params'), validate(updateAttendanceSchema), attendanceController.update);
router.delete('/:id', ...adminGuard, validate(idParamSchema, 'params'), attendanceController.remove);

module.exports = router;
