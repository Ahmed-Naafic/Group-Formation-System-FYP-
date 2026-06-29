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
    fcmToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Partial unique indexes: only index documents where the field is an actual string.
// This allows unlimited documents with null email/studentId without uniqueness collisions,
// while still preventing two admins from sharing an email or two students sharing a studentId.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } }
);

userSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('User', userSchema);
