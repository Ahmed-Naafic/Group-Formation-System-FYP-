const mongoose = require('mongoose');

// One document per group per generation run.
// courseOfferingId + generationId link all groups from a single run.
// cohortId is stored denormalised so pair-avoidance can query across ALL offerings for a cohort.
// No soft-delete — history is an immutable audit record.
const groupHistorySchema = new mongoose.Schema(
  {
    courseOfferingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    cohortId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort',         required: true },
    generationId:     { type: mongoose.Schema.Types.ObjectId, required: true },
    memberIds:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    leaderId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    generatedAt:      { type: Date, default: Date.now },
    groupSize:        { type: Number, required: true },
    options:          { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: false },
);

// Primary query: all history for a cohort (pair-avoidance reads across offerings).
groupHistorySchema.index({ cohortId: 1, generatedAt: -1 });

module.exports = mongoose.model('GroupHistory', groupHistorySchema);
