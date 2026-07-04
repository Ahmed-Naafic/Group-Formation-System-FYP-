const { Router }      = require('express');
const rateLimit       = require('express-rate-limit');
const authController  = require('../controllers/authController');
const { authenticate, authenticateForPasswordChange } = require('../../../middleware/auth');
const validate        = require('../../../common/validators/validate');
const { loginSchema, changePasswordSchema } = require('../validations/authValidation');

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

module.exports = router;
