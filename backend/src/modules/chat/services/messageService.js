const messageRepository   = require('../repositories/messageRepository');
const fileRepository      = require('../../file/repositories/fileRepository');
const workspaceService    = require('../../workspace/services/workspaceService');
const workspaceRepository = require('../../workspace/repositories/workspaceRepository');
const groupRepository     = require('../../group/repositories/groupRepository');
const courseOfferingService = require('../../courseOffering/services/courseOfferingService');
const StorageService      = require('../../../common/services/storage/StorageService');
const emitter             = require('../../../common/events/emitter');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');

// Short, mimetype-aware preview text for the FCM push notification —
// mirrors the '🎤 Voice message' preview sendVoice() already uses.
function attachmentPreview(mimeType, originalName) {
  if (mimeType.startsWith('image/')) return '📷 Photo';
  if (mimeType.startsWith('video/')) return '🎥 Video';
  return `📎 ${originalName}`;
}

// Shared by send() and sendVoice() — a reply target must exist and belong to
// the same workspace. Soft-deleted messages are excluded by findById's query
// middleware, so replying to a deleted message correctly fails here too.
async function assertReplyTargetValid(workspaceId, replyToId) {
  if (!replyToId) return;
  const target = await messageRepository.findById(replyToId);
  if (!target || String(target.workspaceId) !== String(workspaceId)) {
    throw new BadRequestError('The message being replied to could not be found');
  }
}

const messageService = {
  /**
   * Returns paginated messages for a workspace.
   * `before` is an optional messageId; if provided returns messages older than that message.
   * Access check is delegated to workspaceService.assertMembership so ownership rules live in one place.
   */
  async list(workspaceId, { limit, before, after }, context) {
    await workspaceService.assertMembership(workspaceId, context);
    const messages = await messageRepository.findByWorkspace(workspaceId, { limit, before, after });
    // Return chronological order (oldest first) for the client to render top-to-bottom
    return messages.reverse();
  },

  /**
   * Persists a new message and returns it populated.
   * Admin is NOT allowed to chat (see §2.2 permissions matrix).
   */
  async send(workspaceId, content, context, replyToId = null) {
    if (context.role === 'admin') {
      throw new ForbiddenError('Admins cannot send chat messages');
    }
    await workspaceService.assertMembership(workspaceId, context);
    await assertReplyTargetValid(workspaceId, replyToId);
    return messageRepository.create({
      workspaceId,
      senderId: context.userId,
      content,
      replyTo:  replyToId || null,
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
  async sendVoice(workspaceId, multerFile, durationSeconds, context, replyToId = null) {
    if (context.role === 'admin') {
      throw new ForbiddenError('Admins cannot send chat messages');
    }
    await workspaceService.assertMembership(workspaceId, context);
    await assertReplyTargetValid(workspaceId, replyToId);

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
      replyTo:        replyToId || null,
    });
    await message.populate([
      { path: 'senderId', select: 'fullName role studentId' },
      { path: 'replyTo', select: 'content senderId audioDuration', populate: { path: 'senderId', select: 'fullName' } },
    ]);

    emitter.emit('chat.voiceMessage', { workspaceId: String(workspaceId), message });
    emitter.emit('message.sent', {
      workspaceId:  String(workspaceId),
      messageId:    String(message._id),
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
   * Uploads an image/video/document, persists it as a File (so it also shows
   * up in the workspace's Files tab, same as any other upload there), and
   * sends a message referencing it. Mirrors sendVoice() in every other
   * respect — REST-only (multipart), broadcasts via the shared emitter since
   * there's no socket in scope here.
   * `multerFile` is multer's memoryStorage object: { originalname, mimetype, size, buffer }.
   */
  async sendAttachment(workspaceId, multerFile, caption, context, replyToId = null) {
    if (context.role === 'admin') {
      throw new ForbiddenError('Admins cannot send chat messages');
    }
    await workspaceService.assertMembership(workspaceId, context);
    await assertReplyTargetValid(workspaceId, replyToId);

    const { url, publicId } = await StorageService.save(
      multerFile.buffer,
      multerFile.originalname,
      `workspaces/${workspaceId}/chat-attachments`,
      multerFile.mimetype,
    );

    const file = await fileRepository.create({
      workspaceId,
      uploadedBy:   context.userId,
      originalName: multerFile.originalname,
      url,
      publicId,
      mimeType:     multerFile.mimetype,
      sizeBytes:    multerFile.size,
    });

    const message = await messageRepository.create({
      workspaceId,
      senderId:    context.userId,
      content:     caption || '',
      attachments: [file._id],
      replyTo:     replyToId || null,
    });
    await message.populate([
      { path: 'senderId', select: 'fullName role studentId' },
      { path: 'replyTo', select: 'content senderId audioDuration', populate: { path: 'senderId', select: 'fullName' } },
      { path: 'attachments', select: 'originalName mimeType sizeBytes publicId' },
    ]);

    emitter.emit('chat.attachmentMessage', { workspaceId: String(workspaceId), message });
    emitter.emit('message.sent', {
      workspaceId:  String(workspaceId),
      messageId:    String(message._id),
      senderUserId: String(context.userId),
      senderName:   message.senderId?.fullName ?? 'Someone',
      preview:      attachmentPreview(multerFile.mimetype, multerFile.originalname),
    });

    return message;
  },

  /**
   * Sends one copy of the same announcement to every active group's chat in
   * a course offering — instructor-only (admins still can't send any chat
   * message, per the existing rule above), and scoped to offerings the
   * instructor actually owns via courseOfferingService.getById's access
   * check. REST-only (there's no "the" workspace room to reply from), so
   * each copy is broadcast to its room via the shared emitter, mirroring
   * how sendVoice/sendAttachment reach clients that are already in a room.
   */
  async broadcast(courseOfferingId, content, context) {
    if (context.role !== 'instructor') {
      throw new ForbiddenError('Only instructors can send a broadcast announcement');
    }
    // Enforces instructor-owns-offering access; throws otherwise.
    await courseOfferingService.getById(courseOfferingId, context);

    const groups = await groupRepository.findByCourseOffering(courseOfferingId);
    if (groups.length === 0) {
      throw new BadRequestError('This course offering has no active groups to notify');
    }

    const workspaces = await workspaceRepository.findByGroupIds(groups.map((g) => g._id));
    const trimmed = content.trim();
    const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;

    const messages = [];
    for (const workspace of workspaces) {
      // eslint-disable-next-line no-await-in-loop
      const message = await messageRepository.create({
        workspaceId: workspace._id,
        senderId:    context.userId,
        content:     trimmed,
        isBroadcast: true,
      });
      // eslint-disable-next-line no-await-in-loop
      await message.populate({ path: 'senderId', select: 'fullName role studentId' });
      messages.push(message);

      emitter.emit('chat.broadcastMessage', { workspaceId: String(workspace._id), message });
      emitter.emit('message.sent', {
        workspaceId:  String(workspace._id),
        messageId:    String(message._id),
        senderUserId: String(context.userId),
        senderName:   message.senderId?.fullName ?? 'Instructor',
        preview:      `📢 ${preview}`,
      });
    }

    return { sentCount: messages.length, messages };
  },

  /**
   * Resolves a fresh signed URL for playing back a voice message's audio.
   * Mirrors fileService.getForDownload — the bucket is private, so URLs are
   * resolved per-request rather than cached at send-time.
   */
  async getAudioPlaybackUrl(workspaceId, messageId, context) {
    await workspaceService.assertMembership(workspaceId, context);
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
    await workspaceService.assertMembership(workspaceId, context);
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
    await workspaceService.assertMembership(workspaceId, context);
    return messageRepository.markAllRead(workspaceId, context.userId);
  },

  /**
   * Deletes a message for everyone in the workspace. Sender-only (no admin
   * override, unlike task/file deletion) — matches how ephemeral chat
   * messages are treated versus persistent course artifacts. Cleans up the
   * audio blob first, same order fileService.remove uses for attachments.
   */
  async remove(workspaceId, messageId, context) {
    await workspaceService.assertMembership(workspaceId, context);
    const message = await messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message not found');
    if (String(message.workspaceId) !== String(workspaceId)) {
      throw new ForbiddenError('Message does not belong to this workspace');
    }
    if (String(message.senderId?._id ?? message.senderId) !== String(context.userId)) {
      throw new ForbiddenError('You can only delete your own messages');
    }

    if (message.audioPublicId) {
      await StorageService.delete(message.audioPublicId);
    }
    await messageRepository.softDelete(messageId, context.userId);

    // Broadcast to everyone currently in the room — mirrors the
    // 'chat.voiceMessage' pattern (sockets/index.js has the one listener
    // with `io` in scope).
    emitter.emit('chat.messageDeleted', {
      workspaceId: String(workspaceId),
      messageId:   String(messageId),
    });
  },

  /**
   * Sets (or, tapping the same emoji again, clears) the caller's reaction on
   * a message. Anyone in the workspace may react — unlike delete, this isn't
   * sender-only. Broadcasts the full updated message so every client's local
   * reaction list stays in sync without a separate diffing step.
   */
  async react(workspaceId, messageId, emoji, context) {
    await workspaceService.assertMembership(workspaceId, context);
    const message = await messageRepository.setReaction(messageId, context.userId, emoji);
    if (!message) throw new NotFoundError('Message not found');
    if (String(message.workspaceId) !== String(workspaceId)) {
      throw new ForbiddenError('Message does not belong to this workspace');
    }

    emitter.emit('chat.messageReacted', { workspaceId: String(workspaceId), message });
    return message;
  },
};

module.exports = messageService;
