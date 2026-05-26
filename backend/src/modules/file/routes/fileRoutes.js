const { Router }  = require('express');
const multer      = require('multer');
const { authenticate } = require('../../../middleware/auth');
const { requireRole }  = require('../../../middleware/rbac');
const validate         = require('../../../common/validators/validate');
const Joi              = require('joi');
const fileController   = require('../controllers/fileController');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../validations/fileValidation');
const { BadRequestError } = require('../../../common/errors');

const router = Router({ mergeParams: true });

const objectId = Joi.string().hex().length(24);
const wsParam  = Joi.object({ workspaceId: objectId.required() });
const fileParam = Joi.object({ workspaceId: objectId.required(), fileId: objectId.required() });

// Multer: memory storage so StorageService controls where and how files land on disk.
// Mime-type filter runs before the controller; file size limit enforced by multer.
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestError(`File type '${file.mimetype}' is not allowed`));
  },
});

router.use(authenticate, requireRole('admin', 'instructor', 'student'));

router.get(
  '/',
  validate(wsParam, 'params'),
  fileController.list,
);

router.post(
  '/',
  validate(wsParam, 'params'),
  upload.single('file'),
  fileController.upload,
);

router.get(
  '/:fileId/download',
  validate(fileParam, 'params'),
  fileController.download,
);

router.delete(
  '/:fileId',
  validate(fileParam, 'params'),
  fileController.remove,
);

module.exports = router;
