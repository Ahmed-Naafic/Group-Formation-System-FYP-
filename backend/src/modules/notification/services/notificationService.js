const notificationRepository = require('../repositories/notificationRepository');
const { NotFoundError }      = require('../../../common/errors');

const notificationService = {
  /**
   * Creates a notification for a single user.
   * Returns the saved document (used by listeners to push via Socket.IO).
   */
  create({ userId, type, title, message, relatedEntity = {} }) {
    return notificationRepository.create({ userId, type, title, message, relatedEntity });
  },

  /**
   * Bulk-creates notifications for multiple users (e.g. all group members).
   * Silent on partial failures — insertMany with ordered:false.
   */
  createMany(docs) {
    return notificationRepository.insertMany(docs);
  },

  /**
   * Returns the requesting user's notification inbox.
   */
  async findForUser(userId, { limit, unreadOnly }) {
    const notifications = await notificationRepository.findForUser(userId, { limit, unreadOnly });
    const unreadCount   = await notificationRepository.countUnread(userId);
    return { notifications, unreadCount };
  },

  /**
   * Marks a single notification as read (must belong to the requesting user).
   */
  async markRead(id, userId) {
    const updated = await notificationRepository.markRead(id, userId);
    if (!updated) throw new NotFoundError('Notification not found');
    return updated;
  },

  /**
   * Marks all of the user's notifications as read.
   */
  markAllRead(userId) {
    return notificationRepository.markAllRead(userId);
  },
};

module.exports = notificationService;
