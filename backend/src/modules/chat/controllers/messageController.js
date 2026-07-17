const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const messageService  = require('../services/messageService');
const { BadRequestError } = require('../../../common/errors');

const messageController = {
  // GET /api/workspaces/:workspaceId/messages?limit=50&before=<msgId>
  list: asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { limit, before, after } = req.query;
    const messages = await messageService.list(
      workspaceId,
      { limit: limit ? Number(limit) : 50, before: before || null, after: after || null },
      req.context,
    );
    return sendSuccess(res, { data: { messages } });
  }),

  // POST /api/workspaces/:workspaceId/messages
  send: asyncHandler(async (req, res) => {
    const message = await messageService.send(
      req.params.workspaceId,
      req.body.content,
      req.context,
    );
    // Populate sender for the HTTP response (socket path populates inline)
    await message.populate({ path: 'senderId', select: 'fullName role studentId' });
    return sendSuccess(res, { status: 201, data: { message } });
  }),

  // POST /api/workspaces/:workspaceId/messages/voice
  sendVoice: asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No audio file provided');
    const message = await messageService.sendVoice(
      req.params.workspaceId,
      req.file,
      req.body.duration,
      req.context,
    );
    return sendSuccess(res, { status: 201, data: { message } });
  }),

  // GET /api/workspaces/:workspaceId/messages/:messageId/audio
  // Returns the signed URL as JSON (rather than redirecting, the convention
  // used by file downloads) so a native audio player can load it directly
  // without needing to follow an authenticated redirect mid-playback.
  audio: asyncHandler(async (req, res) => {
    const url = await messageService.getAudioPlaybackUrl(
      req.params.workspaceId, req.params.messageId, req.context,
    );
    return sendSuccess(res, { data: { url } });
  }),

  // PATCH /api/workspaces/:workspaceId/messages/:messageId/read
  markRead: asyncHandler(async (req, res) => {
    await messageService.markRead(req.params.workspaceId, req.params.messageId, req.context);
    return sendSuccess(res, { message: 'Marked as read' });
  }),

  // POST /api/workspaces/:workspaceId/messages/read-all
  markAllRead: asyncHandler(async (req, res) => {
    await messageService.markAllRead(req.params.workspaceId, req.context);
    return sendSuccess(res, { message: 'All messages marked as read' });
  }),
};

module.exports = messageController;
