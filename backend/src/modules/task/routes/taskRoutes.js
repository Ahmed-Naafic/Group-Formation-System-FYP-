const { Router }       = require('express');
const multer           = require('multer');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate         = require('../../../common/validators/validate');
const taskController   = require('../controllers/taskController');
const taskValidation   = require('../validations/taskValidation');
const submissionController = require('../../submission/controllers/submissionController');
const submissionValidation = require('../../submission/validations/submissionValidation');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../../file/validations/fileValidation');
const { BadRequestError } = require('../../../common/errors');

const router = Router();

// ── Multer — same config as workspace file upload ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestError(`File type '${file.mimetype}' is not allowed`));
  },
});

// When the request is multipart the assignedGroupIds field arrives as a
// JSON-encoded string; parse it back to an array before Joi validation runs.
function parseMultipartBody(req, _res, next) {
  if (typeof req.body.assignedGroupIds === 'string') {
    try   { req.body.assignedGroupIds = JSON.parse(req.body.assignedGroupIds); }
    catch { req.body.assignedGroupIds = []; }
  }
  next();
}

// ── Task CRUD ──────────────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate, requireRole('admin', 'instructor'),
  upload.single('file'),
  parseMultipartBody,
  validate(taskValidation.createTask, 'body'),
  taskController.create,
);

router.post(
  '/bulk',
  authenticate, requireRole('admin', 'instructor'),
  validate(taskValidation.bulkCreate, 'body'),
  taskController.createBulk,
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

router.get(
  '/:id/attachment',
  authenticate, requireRole('admin', 'instructor', 'student'),
  validate(taskValidation.idParam, 'params'),
  taskController.downloadAttachment,
);

// ── Submission sub-resources (nested under task) ───────────────────────────────

// Student: get their group's submission for a task (null if not started)
router.get(
  '/:taskId/my-submission',
  authenticate, requireRole('student'),
  validate(submissionValidation.taskIdParam, 'params'),
  submissionController.getMySubmission,
);

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
