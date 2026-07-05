const asyncHandler      = require('../../../common/utils/asyncHandler');
const { sendSuccess }   = require('../../../common/responses/apiResponse');
const { NotFoundError } = require('../../../common/errors');
const taskService       = require('../services/taskService');
const StorageService    = require('../../../common/services/storage/StorageService');

const taskController = {
  create: asyncHandler(async (req, res) => {
    const task = await taskService.create(req.body, req.context, req.file ?? null);
    return sendSuccess(res, { status: 201, data: { task } });
  }),

  downloadAttachment: asyncHandler(async (req, res) => {
    const { publicId, originalName } = await taskService.getAttachment(req.params.id, req.context);
    if (!publicId) {
      throw new NotFoundError(`Attachment file not found (no storage path for "${originalName}")`);
    }
    const signedUrl = await StorageService.createSignedUrl(publicId);
    return res.redirect(signedUrl);
  }),

  list: asyncHandler(async (req, res) => {
    const tasks = await taskService.list(req.query.courseOfferingId, req.context);
    return sendSuccess(res, { data: { tasks } });
  }),

  getById: asyncHandler(async (req, res) => {
    const task = await taskService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { task } });
  }),

  update: asyncHandler(async (req, res) => {
    const task = await taskService.update(req.params.id, req.body, req.context);
    return sendSuccess(res, { data: { task } });
  }),

  remove: asyncHandler(async (req, res) => {
    await taskService.remove(req.params.id, req.context);
    return sendSuccess(res, { message: 'Task deleted' });
  }),
};

module.exports = taskController;
