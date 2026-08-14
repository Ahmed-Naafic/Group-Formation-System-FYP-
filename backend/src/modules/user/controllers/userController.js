const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const userService = require('../services/userService');

const userController = {
  // GET /api/users?role=instructor&isActive=true
  getAll: asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const users = await userService.findAll(filter);
    return sendSuccess(res, { data: { users } });
  }),

  // POST /api/users — admin creates an admin or instructor account
  create: asyncHandler(async (req, res) => {
    const user = await userService.createStaffUser(req.body, req.context);
    const label = req.body.role === 'admin' ? 'Admin' : 'Instructor';
    return sendSuccess(res, { status: 201, message: `${label} registered`, data: { user } });
  }),

  // PATCH /api/users/:id
  update: asyncHandler(async (req, res) => {
    const user = await userService.updateInstructor(req.params.id, req.body, req.context);
    return sendSuccess(res, { message: 'Account updated', data: { user } });
  }),

  // DELETE /api/users/:id
  remove: asyncHandler(async (req, res) => {
    await userService.remove(req.params.id, req.context);
    return sendSuccess(res, { message: 'Account deleted' });
  }),

  // PATCH /api/users/:id/restore
  restore: asyncHandler(async (req, res) => {
    const user = await userService.restoreUser(req.params.id, req.context);
    return sendSuccess(res, { message: 'Account restored', data: { user } });
  }),

  // PATCH /api/users/:id/activate
  activate: asyncHandler(async (req, res) => {
    const user = await userService.setActive(req.params.id, true, req.context);
    return sendSuccess(res, { message: 'Account activated', data: { user } });
  }),

  // PATCH /api/users/:id/deactivate
  deactivate: asyncHandler(async (req, res) => {
    const user = await userService.setActive(req.params.id, false, req.context);
    return sendSuccess(res, { message: 'Account deactivated', data: { user } });
  }),

  // POST /api/users/:id/reset-password
  resetPassword: asyncHandler(async (req, res) => {
    const result = await userService.resetPassword(req.params.id, req.context);
    return sendSuccess(res, { message: 'Password reset', data: result });
  }),
};

module.exports = userController;
