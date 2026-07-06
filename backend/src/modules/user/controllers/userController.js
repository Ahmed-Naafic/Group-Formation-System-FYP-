const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const { ConflictError } = require('../../../common/errors');
const userService = require('../services/userService');

const userController = {
  // GET /api/users?role=instructor
  getAll: asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await userService.findAll(filter);
    return sendSuccess(res, { data: { users } });
  }),

  // POST /api/users  — admin creates an instructor account
  create: asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body;

    const existing = await userService.findByEmail(email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const user = await userService.createUser({ fullName, email, role: 'instructor', password });
    return sendSuccess(res, { status: 201, message: 'Instructor registered', data: { user } });
  }),

  // PATCH /api/users/:id
  update: asyncHandler(async (req, res) => {
    const user = await userService.updateInstructor(req.params.id, req.body);
    return sendSuccess(res, { message: 'Instructor updated', data: { user } });
  }),

  // DELETE /api/users/:id
  remove: asyncHandler(async (req, res) => {
    await userService.deleteInstructor(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Instructor deleted' });
  }),

  // PATCH /api/users/:id/activate
  activate: asyncHandler(async (req, res) => {
    const user = await userService.setActive(req.params.id, true, req.context.userId);
    return sendSuccess(res, { message: 'Instructor activated', data: { user } });
  }),

  // PATCH /api/users/:id/deactivate
  deactivate: asyncHandler(async (req, res) => {
    const user = await userService.setActive(req.params.id, false, req.context.userId);
    return sendSuccess(res, { message: 'Instructor deactivated', data: { user } });
  }),
};

module.exports = userController;
