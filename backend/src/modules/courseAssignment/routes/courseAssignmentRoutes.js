const { Router } = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { createAssignmentSchema, assignmentParamSchema } = require('../validations/courseAssignmentValidation');
const courseAssignmentController = require('../controllers/courseAssignmentController');

const router = Router();

router.use(authenticate, requireRole('admin', 'instructor'));

// Admin-only: create and delete assignments
router.post('/',    requireRole('admin'), validate(createAssignmentSchema), courseAssignmentController.create);
router.delete('/:id', requireRole('admin'), validate(assignmentParamSchema, 'params'), courseAssignmentController.remove);

// Admin + instructor: read assignments (instructor sees only own)
router.get('/',    courseAssignmentController.getAll);
router.get('/:id', validate(assignmentParamSchema, 'params'), courseAssignmentController.getById);

module.exports = router;
