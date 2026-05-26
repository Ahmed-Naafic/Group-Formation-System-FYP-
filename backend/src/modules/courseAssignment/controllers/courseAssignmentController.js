const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const courseAssignmentService = require('../services/courseAssignmentService');

const courseAssignmentController = {
  // POST /api/course-assignments
  create: asyncHandler(async (req, res) => {
    const assignment = await courseAssignmentService.create(req.body, req.context.userId);
    return sendSuccess(res, { status: 201, message: 'Instructor assigned', data: { assignment } });
  }),

  // GET /api/course-assignments
  getAll: asyncHandler(async (req, res) => {
    const assignments = await courseAssignmentService.getAll(req.context);
    return sendSuccess(res, { data: { assignments } });
  }),

  // GET /api/course-assignments/:id
  getById: asyncHandler(async (req, res) => {
    const assignment = await courseAssignmentService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { assignment } });
  }),

  // DELETE /api/course-assignments/:id
  remove: asyncHandler(async (req, res) => {
    await courseAssignmentService.remove(req.params.id, req.context.userId, req.context);
    return sendSuccess(res, { message: 'Assignment removed', data: null });
  }),
};

module.exports = courseAssignmentController;
