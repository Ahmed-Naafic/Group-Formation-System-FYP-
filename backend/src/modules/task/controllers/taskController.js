const https           = require('https');
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
    // Stream from Supabase directly to the client — no RAM buffering
    const parsed = new URL(url);
    await new Promise((resolve, reject) => {
      https.get(
        {
          hostname: parsed.hostname,
          path:     parsed.pathname + parsed.search,
          headers: {
            apikey:        process.env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          },
        },
        (upstream) => {
          if (upstream.statusCode >= 400) {
            upstream.resume();
            return reject(new Error(`Storage returned ${upstream.statusCode}`));
          }
          res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
          res.setHeader('Content-Type', mimeType || 'application/octet-stream');
          if (upstream.headers['content-length']) {
            res.setHeader('Content-Length', upstream.headers['content-length']);
          }
          upstream.pipe(res);
          upstream.on('end',   resolve);
          upstream.on('error', reject);
        },
      ).on('error', reject);
    });
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
