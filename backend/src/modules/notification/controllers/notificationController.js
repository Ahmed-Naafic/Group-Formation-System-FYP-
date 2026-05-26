const asyncHandler       = require('../../../common/utils/asyncHandler');
const { sendSuccess }    = require('../../../common/responses/apiResponse');
const notificationService = require('../services/notificationService');

const notificationController = {
  // GET /api/notifications?limit=30&unreadOnly=false
  list: asyncHandler(async (req, res) => {
    const limit      = req.query.limit      ? Number(req.query.limit)         : 30;
    const unreadOnly = req.query.unreadOnly === 'true';
    const result     = await notificationService.findForUser(req.context.userId, { limit, unreadOnly });
    return sendSuccess(res, { data: result });
  }),

  // PATCH /api/notifications/:id/read
  markRead: asyncHandler(async (req, res) => {
    const notification = await notificationService.markRead(req.params.id, req.context.userId);
    return sendSuccess(res, { data: { notification } });
  }),

  // PATCH /api/notifications/read-all
  markAllRead: asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.context.userId);
    return sendSuccess(res, { message: 'All notifications marked as read' });
  }),
};

module.exports = notificationController;
