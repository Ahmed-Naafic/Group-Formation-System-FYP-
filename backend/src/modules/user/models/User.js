const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    studentId: {
      type: String,
      trim: true,
      default: null,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'instructor', 'student'],
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    avatarPublicId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Partial unique indexes: only index documents where the field is an actual string,
// AND the account isn't soft-deleted — otherwise a deleted account permanently
// blocks re-registering a new one at the same email/studentId (see
// migrateUserIndexes in config/db.js for the one-time index migration this needed).
// This allows unlimited documents with null email/studentId without uniqueness collisions,
// while still preventing two admins from sharing an email or two students sharing a studentId.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' }, deletedAt: null } }
);
userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' }, deletedAt: null } }
);

userSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('User', userSchema);
