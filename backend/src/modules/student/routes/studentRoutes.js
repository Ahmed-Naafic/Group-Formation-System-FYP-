const { Router } = require('express');
const multer = require('multer');
const { authenticate } = require('../../../middleware/auth');
const { requireRole } = require('../../../middleware/rbac');
const validate = require('../../../common/validators/validate');
const { BadRequestError } = require('../../../common/errors');
const {
  createStudentSchema,
  updateStudentSchema,
  bulkUploadSchema,
  clearByCohortSchema,
  trashQuerySchema,
} = require('../validations/studentValidation');
const studentController = require('../controllers/studentController');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.originalname.toLowerCase().endsWith('.csv') ||
      file.originalname.toLowerCase().endsWith('.xlsx');
    if (ok) return cb(null, true);
    cb(new BadRequestError('Only .csv and .xlsx files are accepted'));
  },
});

// Student-facing — must come BEFORE the admin/instructor guard below
router.get('/me', authenticate, requireRole('student'), studentController.getMe);

router.use(authenticate, requireRole('admin', 'instructor'));

router.post(
  '/bulk-upload',
  requireRole('admin'),
  upload.single('file'),
  validate(bulkUploadSchema),
  studentController.bulkUpload,
);

router.post('/',   requireRole('admin'), validate(createStudentSchema), studentController.create);
router.get('/',    studentController.getAll);

// Must come before GET /:id — otherwise "trash" is parsed as an :id value.
router.get('/trash', validate(trashQuerySchema, 'query'), studentController.getTrash);

router.get('/:id', studentController.getById);
router.patch('/:id', validate(updateStudentSchema), studentController.update);
router.delete('/', requireRole('admin'), validate(clearByCohortSchema, 'query'), studentController.clearByCohort);
router.delete('/:id', studentController.remove);

router.post('/:id/reset-password', studentController.resetPassword);
router.post('/:id/restore',        studentController.restore);
router.delete('/:id/permanent',    requireRole('admin'), studentController.permanentDelete);

module.exports = router;
