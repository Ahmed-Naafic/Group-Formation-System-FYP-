const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole:  { type: String, required: true },
    action:     { type: String, required: true, index: true }, // e.g. GROUP_GENERATED
    entityKind: { type: String, required: true },              // e.g. Group, Submission
    entityId:   { type: mongoose.Schema.Types.ObjectId },
    changes:    { type: mongoose.Schema.Types.Mixed },
    ipAddress:  { type: String },
    userAgent:  { type: String },
    timestamp:  { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
