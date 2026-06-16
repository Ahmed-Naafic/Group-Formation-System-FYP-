const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const taskService     = require('../services/taskService');

const taskController = {
  // POST /api/tasks
  create: asyncHandler(async (req, res) => {
    const task = await taskService.create(req.body, req.context);
    return sendSuccess(res, { status: 201, data: { task } });
  }),

  // GET /api/tasks?courseOfferingId=
  list: asyncHandler(async (req, res) => {
    const tasks = await taskService.list(req.query.courseOfferingId, req.context);
    return sendSuccess(res, { data: { tasks } });
  }),

  // GET /api/tasks/:id
  getById: asyncHandler(async (req, res) => {
    const task = await taskService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { task } });
  }),

  // PATCH /api/tasks/:id
  update: asyncHandler(async (req, res) => {
    const task = await taskService.update(req.params.id, req.body, req.context);
    return sendSuccess(res, { data: { task } });
  }),

  // DELETE /api/tasks/:id
  remove: asyncHandler(async (req, res) => {
    await taskService.remove(req.params.id, req.context);
    return sendSuccess(res, { message: 'Task deleted' });
  }),
};

module.exports = taskController;
