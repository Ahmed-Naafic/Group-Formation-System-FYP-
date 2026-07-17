const Message = require('../models/Message');

const SENDER_POPULATE    = { path: 'senderId', select: 'fullName role studentId avatarUrl' };
const REACTIONS_POPULATE = { path: 'reactions.userId', select: 'fullName' };
// If the original message was later (soft-)deleted, populate resolves this to
// null (the softDelete plugin's query-middleware excludes it) — the client
// just renders no quote block in that case, same as a message with no reply.
const REPLY_POPULATE = {
  path: 'replyTo',
  select: 'content senderId audioDuration',
  populate: { path: 'senderId', select: 'fullName' },
};
const BASE_POPULATE = [SENDER_POPULATE, REACTIONS_POPULATE, REPLY_POPULATE];

const messageRepository = {
  create(data) {
    return Message.create(data);
  },

  // Paginated, oldest-first within the page.
  // `before` (msgId) → messages older than that message (load more / history)
  // `after`  (msgId) → messages newer than that message (background catch-up sync)
  async findByWorkspace(workspaceId, { limit = 50, before = null, after = null } = {}) {
    const query = { workspaceId };
    if (before) {
      const ref = await Message.findById(before).lean();
      if (ref) query.createdAt = { $lt: ref.createdAt };
    }
    if (after) {
      const ref = await Message.findById(after).lean();
      if (ref) query.createdAt = { ...(query.createdAt ?? {}), $gt: ref.createdAt };
    }
    return Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate(BASE_POPULATE)
      .lean();
  },

  findById(id) {
    return Message.findById(id).populate(BASE_POPULATE);
  },

  // Append a readBy entry for userId (deduplicates via $addToSet on userId)
  async markRead(messageId, userId) {
    return Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: { userId, readAt: new Date() } } },
      { new: true },
    );
  },

  // Mark all unread messages in a workspace as read for a given user
  async markAllRead(workspaceId, userId) {
    return Message.updateMany(
      { workspaceId, 'readBy.userId': { $ne: userId } },
      { $addToSet: { readBy: { userId, readAt: new Date() } } },
    );
  },

  softDelete(id, deletedBy) {
    return Message.findById(id).then((m) => m?.softDelete(deletedBy));
  },

  // One reaction per user per message: same emoji again removes it, a
  // different emoji replaces the previous one. Returns null if the message
  // doesn't exist (or is soft-deleted — same query middleware applies here).
  async setReaction(messageId, userId, emoji) {
    const message = await Message.findById(messageId);
    if (!message) return null;

    const existingIdx = message.reactions.findIndex((r) => String(r.userId) === String(userId));
    if (existingIdx !== -1 && message.reactions[existingIdx].emoji === emoji) {
      message.reactions.splice(existingIdx, 1);
    } else if (existingIdx !== -1) {
      message.reactions[existingIdx].emoji = emoji;
    } else {
      message.reactions.push({ userId, emoji });
    }
    await message.save();
    return message.populate(BASE_POPULATE);
  },
};

module.exports = messageRepository;
