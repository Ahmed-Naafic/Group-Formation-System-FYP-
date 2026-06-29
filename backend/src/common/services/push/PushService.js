const { getMessaging } = require('../../../config/firebase');
const logger = require('../../utils/logger');

const pushService = {
  /**
   * Send a push notification to a single FCM token.
   * Silent no-op if Firebase is not configured or the token is falsy.
   */
  async send(token, title, body, data = {}) {
    const messaging = getMessaging();
    if (!messaging || !token) return;

    try {
      await messaging.send({
        token,
        notification: { title, body },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: {
          priority: 'high',
          notification: { channelId: 'high_importance_channel' },
        },
      });
    } catch (err) {
      // Stale token — log and move on; do not crash the caller
      logger.warn('FCM send failed', { token: token.slice(0, 16) + '…', err: err.message });
    }
  },

  /**
   * Send to multiple tokens in one batch call.
   * Tokens array can be empty (noop).
   */
  async sendBatch(tokens, title, body, data = {}) {
    const messaging = getMessaging();
    if (!messaging || !tokens.length) return;

    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );

    const messages = tokens.map((token) => ({
      token,
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: { channelId: 'high_importance_channel' },
      },
    }));

    try {
      const result = await messaging.sendEach(messages);
      const failures = result.responses.filter((r) => !r.success).length;
      if (failures) {
        logger.warn(`FCM batch: ${failures}/${messages.length} failed`);
      }
    } catch (err) {
      logger.warn('FCM batch send failed', { err: err.message });
    }
  },
};

module.exports = pushService;
