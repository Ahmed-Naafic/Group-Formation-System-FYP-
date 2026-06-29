const { authService, TOKEN_SCOPES } = require('../services/authService');
const userService = require('../../user/services/userService');
const userRepository = require('../../user/repositories/userRepository');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const asyncHandler = require('../../../common/utils/asyncHandler');

const authController = {
  login: asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    const result = await authService.login({ identifier, password });

    if (result.mustChangePassword) {
      return sendSuccess(res, {
        status: 200,
        message: 'Password change required',
        data: { mustChangePassword: true, token: result.token },
      });
    }

    return sendSuccess(res, {
      message: 'Login successful',
      data: { token: result.token, user: result.user },
    });
  }),

  changePassword: asyncHandler(async (req, res) => {
    const { userId, scope } = req.context;
    const { currentPassword, newPassword } = req.body;

    // Forced change (limited token): no current password needed
    // Voluntary change (full token): current password required
    const isForcedChange = scope === TOKEN_SCOPES.CHANGE_PASSWORD;
    if (!isForcedChange && !currentPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: ['currentPassword is required when changing password voluntarily'],
        },
      });
    }

    const result = await authService.changePassword({
      userId,
      newPassword,
      currentPassword: isForcedChange ? undefined : currentPassword,
    });

    return sendSuccess(res, {
      message: 'Password changed successfully',
      data: { token: result.token, user: result.user },
    });
  }),

  me: asyncHandler(async (req, res) => {
    const user = await userService.findById(req.context.userId);
    return sendSuccess(res, { data: { user } });
  }),

  logout: asyncHandler(async (_req, res) => {
    // Stateless logout — client discards the token.
    // A token blacklist (Redis) can be layered on here later without changing this contract.
    return sendSuccess(res, { message: 'Logged out successfully', data: null });
  }),

  registerFcmToken: asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'token is required' } });
    }
    await userRepository.saveFcmToken(req.context.userId, token);
    return sendSuccess(res, { message: 'FCM token registered', data: null });
  }),

  clearFcmToken: asyncHandler(async (req, res) => {
    await userRepository.saveFcmToken(req.context.userId, null);
    return sendSuccess(res, { message: 'FCM token cleared', data: null });
  }),
};

module.exports = authController;
