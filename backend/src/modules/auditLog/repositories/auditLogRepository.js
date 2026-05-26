const AuditLog = require('../models/AuditLog');

const auditLogRepository = {
  create(data) {
    // Fire-and-forget friendly — returns the promise but callers may not await it
    return AuditLog.create(data);
  },

  find({ action, entityKind, actorId, limit = 50, skip = 0 } = {}) {
    const filter = {};
    if (action)     filter.action     = action;
    if (entityKind) filter.entityKind = entityKind;
    if (actorId)    filter.actorId    = actorId;
    return AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'actorId', select: 'fullName role email' })
      .lean();
  },

  count(filter = {}) {
    return AuditLog.countDocuments(filter);
  },
};

module.exports = auditLogRepository;
