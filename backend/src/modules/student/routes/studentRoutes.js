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
  clearByClassSchema,
} = require('../validations/studentValidation');
const studentController = require('../controllers/studentController');

const router = Router();

// Multer: keep file in memory, max 5 MB, .csv and .xlsx only
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

// All student-management endpoints require at least instructor role
router.use(authenticate, requireRole('admin', 'instructor'));

// ── Specific paths before parameterised routes ────────────────────────────────
router.post(
  '/bulk-upload',
  requireRole('admin'),           // upload is admin-only (MODEL_REVISION_v2 §8)
  upload.single('file'),
  validate(bulkUploadSchema),
  studentController.bulkUpload
);

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.post('/', requireRole('admin'), validate(createStudentSchema), studentController.create);
router.get('/', studentController.getAll);
router.get('/:id', studentController.getById);
router.patch('/:id', validate(updateStudentSchema), studentController.update);
router.delete('/', requireRole('admin'), validate(clearByClassSchema, 'query'), studentController.clearByClass);
router.delete('/:id', studentController.remove);

// ── Password reset ────────────────────────────────────────────────────────────
router.post('/:id/reset-password', studentController.resetPassword);

module.exports = router;
