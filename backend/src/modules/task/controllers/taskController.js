const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const taskService     = require('../services/taskService');

const taskController = {
  // POST /api/tasks
  create: asyncHandler(async (req, res) => {
    const task = await taskService.create(req.body, req.context, req.file ?? null);
    return sendSuccess(res, { status: 201, data: { task } });
  }),

  // GET /api/tasks/:id/attachment
  downloadAttachment: asyncHandler(async (req, res) => {
    const { url, originalName, mimeType } = await taskService.getAttachment(req.params.id, req.context);
    // Proxy through backend — avoids CORS issues and Supabase auth on clients
    const fileRes = await fetch(url, {
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!fileRes.ok) throw new Error(`Storage returned ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
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
