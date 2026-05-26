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
};

module.exports = userController;
