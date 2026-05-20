const { Router } = require('express');
const authController = require('../controllers/authController');
const { authenticate, authenticateForPasswordChange } = require('../../../middleware/auth');
const validate = require('../../../common/validators/validate');
const { loginSchema, changePasswordSchema } = require('../validations/authValidation');

const router = Router();

// Public
router.post('/login', validate(loginSchema), authController.login);

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

module.exports = router;
