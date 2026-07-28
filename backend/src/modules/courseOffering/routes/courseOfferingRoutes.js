const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const {
  createCourseOfferingSchema,
  updateCourseOfferingSchema,
  idParamSchema,
  offeringQuerySchema,
} = require('../validations/courseOfferingValidation');
const courseOfferingController = require('../controllers/courseOfferingController');

const router = Router();

router.use(authenticate, requireRole('admin', 'instructor'));

// List and detail: admin + instructor (instructor sees only own offerings via service layer)
router.get('/',    validate(offeringQuerySchema, 'query'), courseOfferingController.getAll);
router.get('/:id', validate(idParamSchema, 'params'),      courseOfferingController.getById);

// Instructor assignment history — auditing/reporting only, same ownership
// gate as getById (a reassigned-away instructor gets 403 here too).
router.get(
  '/:id/instructor-history',
  validate(idParamSchema, 'params'),
  courseOfferingController.getInstructorHistory,
);

// Mutations: admin only (enforced in service layer for update/delete)
router.post('/',      requireRole('admin'), validate(createCourseOfferingSchema), courseOfferingController.create);
router.patch('/:id',  validate(idParamSchema, 'params'), validate(updateCourseOfferingSchema), courseOfferingController.update);
router.delete('/:id', validate(idParamSchema, 'params'), courseOfferingController.remove);

module.exports = router;
