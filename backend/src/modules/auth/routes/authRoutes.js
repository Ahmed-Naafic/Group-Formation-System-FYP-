const { Router }      = require('express');
const rateLimit       = require('express-rate-limit');
const multer          = require('multer');
const authController  = require('../controllers/authController');
const { authenticate, authenticateForPasswordChange } = require('../../../middleware/auth');
const validate        = require('../../../common/validators/validate');
const { loginSchema, changePasswordSchema } = require('../validations/authValidation');
const { BadRequestError } = require('../../../common/errors');

const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter(_req, file, cb) {
    if (AVATAR_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestError('Only JPEG, PNG or WebP images are allowed'));
  },
});

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: '429', error: 'Too many login attempts', message: 'Too many login attempts. Try again in 15 minutes.' },
});

// Public
router.post('/login', loginLimiter, validate(loginSchema), authController.login);

// Accepts both full and limited (change_password) tokens
router.post(
  '/change-password',
  authenticateForPasswordChange,
  validate(changePasswordSchema),
  authController.changePassword
);

// Full token required
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);
router.post('/fcm-token', authenticate, authController.registerFcmToken);
router.delete('/fcm-token', authenticate, authController.clearFcmToken);
router.patch('/avatar', authenticate, avatarUpload.single('avatar'), authController.uploadAvatar);
router.delete('/avatar', authenticate, authController.removeAvatar);

module.exports = router;
