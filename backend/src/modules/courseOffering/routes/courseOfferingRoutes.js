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
const { broadcastMessage: broadcastMessageSchema } = require('../../chat/validations/messageValidation');
const courseOfferingController = require('../controllers/courseOfferingController');
const messageController = require('../../chat/controllers/messageController');

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

// Broadcasts one announcement to every active group's chat in this offering.
// Instructor-only (enforced in messageService.broadcast, same place the
// existing "admins cannot send chat messages" rule lives) — gated here by
// idParamSchema/:id like every other single-offering route, not by role
// middleware, to stay consistent with how that rule is already enforced.
router.post(
  '/:id/broadcast-message',
  validate(idParamSchema, 'params'),
  validate(broadcastMessageSchema),
  messageController.broadcast,
);

// Mutations: admin only (enforced in service layer for update/delete)
router.post('/',      requireRole('admin'), validate(createCourseOfferingSchema), courseOfferingController.create);
router.patch('/:id',  validate(idParamSchema, 'params'), validate(updateCourseOfferingSchema), courseOfferingController.update);
router.delete('/:id', validate(idParamSchema, 'params'), courseOfferingController.remove);

module.exports = router;
