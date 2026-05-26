const Message = require('../models/Message');

const SENDER_POPULATE = { path: 'senderId', select: 'fullName role studentId' };

const messageRepository = {
  create(data) {
    return Message.create(data);
  },

  // Paginated, oldest-first within the page (cursor-based via `before` message ID)
  async findByWorkspace(workspaceId, { limit = 50, before = null } = {}) {
    const query = { workspaceId };
    if (before) {
      const ref = await Message.findById(before).lean();
      if (ref) query.createdAt = { $lt: ref.createdAt };
    }
    return Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate(SENDER_POPULATE)
      .lean();
  },

  findById(id) {
    return Message.findById(id).populate(SENDER_POPULATE);
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
};

module.exports = messageRepository;
