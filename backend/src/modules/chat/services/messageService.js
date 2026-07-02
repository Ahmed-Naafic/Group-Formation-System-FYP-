const messageRepository   = require('../repositories/messageRepository');
const workspaceService    = require('../../workspace/services/workspaceService');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

const messageService = {
  /**
   * Returns paginated messages for a workspace.
   * `before` is an optional messageId; if provided returns messages older than that message.
   * Access check is delegated to workspaceService.getById so ownership rules live in one place.
   */
  async list(workspaceId, { limit, before, after }, context) {
    await workspaceService.getById(workspaceId, context);
    const messages = await messageRepository.findByWorkspace(workspaceId, { limit, before, after });
    // Return chronological order (oldest first) for the client to render top-to-bottom
    return messages.reverse();
  },

  /**
   * Persists a new message and returns it populated.
   * Admin is NOT allowed to chat (see §2.2 permissions matrix).
   */
  async send(workspaceId, content, context) {
    if (context.role === 'admin') {
      throw new ForbiddenError('Admins cannot send chat messages');
    }
    await workspaceService.getById(workspaceId, context);
    return messageRepository.create({
      workspaceId,
      senderId: context.userId,
      content,
    });
  },

  /**
   * Marks a single message as read by the requesting user.
   */
  async markRead(workspaceId, messageId, context) {
    await workspaceService.getById(workspaceId, context);
    const msg = await messageRepository.findById(messageId);
    if (!msg) throw new NotFoundError('Message not found');
    if (String(msg.workspaceId) !== String(workspaceId)) {
      throw new ForbiddenError('Message does not belong to this workspace');
    }
    return messageRepository.markRead(messageId, context.userId);
  },

  /**
   * Marks ALL messages in a workspace as read — called on workspace-open.
   */
  async markAllRead(workspaceId, context) {
    await workspaceService.getById(workspaceId, context);
    return messageRepository.markAllRead(workspaceId, context.userId);
  },
};

module.exports = messageService;
