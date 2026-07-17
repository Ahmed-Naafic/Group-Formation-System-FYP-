const messageRepository   = require('../repositories/messageRepository');
const workspaceService    = require('../../workspace/services/workspaceService');
const StorageService      = require('../../../common/services/storage/StorageService');
const emitter             = require('../../../common/events/emitter');
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
   * Uploads the recorded audio, persists a voice message, and notifies:
   *  - 'chat.voiceMessage' — a socket listener (sockets/index.js) broadcasts it
   *    live to everyone in the workspace room (mirrors the text-message path,
   *    which broadcasts inline from the socket handler instead — REST has no
   *    socket in scope, so it goes through the shared emitter).
   *  - 'message.sent' — reuses the existing FCM-push listener unchanged.
   * `multerFile` is multer's memoryStorage object: { originalname, mimetype, size, buffer }.
   */
  async sendVoice(workspaceId, multerFile, durationSeconds, context) {
    if (context.role === 'admin') {
      throw new ForbiddenError('Admins cannot send chat messages');
    }
    await workspaceService.getById(workspaceId, context);

    const { publicId } = await StorageService.save(
      multerFile.buffer,
      multerFile.originalname,
      `workspaces/${workspaceId}/audio`,
      multerFile.mimetype,
    );

    const message = await messageRepository.create({
      workspaceId,
      senderId:       context.userId,
      content:        '',
      audioPublicId:  publicId,
      audioDuration:  durationSeconds,
      audioSizeBytes: multerFile.size,
    });
    await message.populate({ path: 'senderId', select: 'fullName role studentId' });

    emitter.emit('chat.voiceMessage', { workspaceId: String(workspaceId), message });
    emitter.emit('message.sent', {
      workspaceId:  String(workspaceId),
      senderUserId: String(context.userId),
      // Pulled from the populated sender, not context.fullName — REST's req.context
      // (built by middleware/auth.js) doesn't carry fullName the way the socket
      // auth middleware's manually-bolted-on context does.
      senderName:   message.senderId?.fullName ?? 'Someone',
      preview:      '🎤 Voice message',
    });

    return message;
  },

  /**
   * Resolves a fresh signed URL for playing back a voice message's audio.
   * Mirrors fileService.getForDownload — the bucket is private, so URLs are
   * resolved per-request rather than cached at send-time.
   */
  async getAudioPlaybackUrl(workspaceId, messageId, context) {
    await workspaceService.getById(workspaceId, context);
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message not found');
    if (String(message.workspaceId) !== String(workspaceId)) {
      throw new ForbiddenError('Message does not belong to this workspace');
    }
    if (!message.audioPublicId) throw new NotFoundError('This message has no audio');
    return StorageService.createSignedUrl(message.audioPublicId);
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
