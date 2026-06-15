const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const studentSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    cohortId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    fullName:  { type: String, required: true, trim: true },
    averageScore: { type: Number, min: 0, max: 100, default: null },
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

// One ACTIVE enrollment per (user, cohort) pair.
// NOTE: drop old userId_1_classId_1 index manually before first restart.
studentSchema.index(
  { userId: 1, cohortId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

// One ACTIVE Student record per user across ALL cohorts (one-active-cohort rule).
studentSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

studentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Student', studentSchema);
