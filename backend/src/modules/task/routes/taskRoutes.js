const { Router }       = require('express');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate         = require('../../../common/validators/validate');
const taskController   = require('../controllers/taskController');
const taskValidation   = require('../validations/taskValidation');
const submissionController = require('../../submission/controllers/submissionController');
const submissionValidation = require('../../submission/validations/submissionValidation');

const router = Router();

// ── Task CRUD ──────────────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate, requireRole('admin', 'instructor'),
  validate(taskValidation.createTask, 'body'),
  taskController.create,
);

router.get(
  '/',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(taskValidation.listTasks, 'query'),
  taskController.list,
);

router.get(
  '/:id',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(taskValidation.idParam, 'params'),
  taskController.getById,
);

router.patch(
  '/:id',
  authenticate, requireRole('admin', 'instructor'),
  validate(taskValidation.idParam, 'params'),
  validate(taskValidation.updateTask, 'body'),
  taskController.update,
);

router.delete(
  '/:id',
  authenticate, requireRole('admin', 'instructor'),
  validate(taskValidation.idParam, 'params'),
  taskController.remove,
);

// ── Submission sub-resources (nested under task) ───────────────────────────────

// Student finalises submission
router.post(
  '/:taskId/submit',
  authenticate, requireRole('student'),
  validate(submissionValidation.taskIdParam, 'params'),
  validate(submissionValidation.submit, 'body'),
  submissionController.submit,
);

// Student saves draft
router.post(
  '/:taskId/draft',
  authenticate, requireRole('student'),
  validate(submissionValidation.taskIdParam, 'params'),
  validate(submissionValidation.submit, 'body'),
  submissionController.saveDraft,
);

// Instructor/admin: list all group submissions for a task
router.get(
  '/:taskId/submissions',
  authenticate, requireRole('admin', 'instructor'),
  validate(submissionValidation.taskIdParam, 'params'),
  submissionController.listByTask,
);

module.exports = router;
