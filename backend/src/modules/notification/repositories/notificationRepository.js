const Notification = require('../models/Notification');

const notificationRepository = {
  create(data) {
    return Notification.create(data);
  },

  insertMany(docs) {
    return Notification.insertMany(docs, { ordered: false });
  },

  findForUser(userId, { limit = 30, unreadOnly = false } = {}) {
    const filter = { userId };
    if (unreadOnly) filter.isRead = false;
    return Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  },

  countUnread(userId) {
    return Notification.countDocuments({ userId, isRead: false });
  },

  markRead(id, userId) {
    return Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
  },

  markAllRead(userId) {
    return Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
  },
};

module.exports = notificationRepository;
