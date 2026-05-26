const auditLogRepository = require('../repositories/auditLogRepository');
const logger             = require('../../../common/utils/logger');

const auditLogService = {
  /**
   * Persists an audit entry.  Always fire-and-forget — log errors but never
   * let an audit failure propagate to the caller.
   */
  async log({ actorId, actorRole, action, entityKind, entityId, changes, ipAddress, userAgent }) {
    try {
      await auditLogRepository.create({
        actorId, actorRole, action, entityKind, entityId, changes, ipAddress, userAgent,
      });
    } catch (err) {
      logger.error('Audit log write failed', { action, err: err.message });
    }
  },

  /**
   * Admin-only paginated audit log query.
   */
  async list({ action, entityKind, actorId, page = 1, limit = 50 }) {
    const skip  = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      auditLogRepository.find({ action, entityKind, actorId, limit, skip }),
      auditLogRepository.count({ action, entityKind, actorId }),
    ]);
    return { logs, total, page, pages: Math.ceil(total / limit) };
  },
};

module.exports = auditLogService;
