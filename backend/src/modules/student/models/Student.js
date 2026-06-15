const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const studentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    fullName: { type: String, required: true, trim: true },
    averageScore: { type: Number, min: 0, max: 100, default: null },
    attendance: { type: Number, min: 0, max: 100, default: 0 },
    performanceCategory: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW', null],
      default: null,
    },
    hasBeenLeader: { type: Boolean, default: false },
    leaderCount:   { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// One ACTIVE enrollment per (user, class) pair — allows soft-deleted records to coexist
// so a cleared/transferred student can be re-enrolled in the same class later.
studentSchema.index(
  { userId: 1, classId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

// One ACTIVE Student record per user across ALL classes (one-active-class rule).
studentSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

studentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Student', studentSchema);
