const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const studentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    fullName: { type: String, required: true, trim: true },
    attendance: { type: Number, min: 0, max: 100, default: 0 },
    scores: {
      midterm: { type: Number, min: 0, default: null },
      final: { type: Number, min: 0, default: null },
      coursework: { type: Number, min: 0, default: null },
    },
    totalScore: { type: Number, default: null },
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

// One student record per class per user account
studentSchema.index({ userId: 1, classId: 1 }, { unique: true });

studentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Student', studentSchema);
