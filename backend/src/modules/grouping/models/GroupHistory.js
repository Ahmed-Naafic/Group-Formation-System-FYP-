const mongoose = require('mongoose');

// One document per group per generation run.
// courseOfferingId + generationId link all groups from a single run.
// courseOfferingId is the sole ownership relationship — pair-avoidance across
// every offering in a cohort is a query-scope concern, not a stored field:
// see GroupGenerationService.generate(), which resolves the cohort's offering
// IDs via courseOfferingRepository.findByCohort() and queries by those.
// No soft-delete — history is an immutable audit record.
const groupHistorySchema = new mongoose.Schema(
  {
    courseOfferingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    generationId:     { type: mongoose.Schema.Types.ObjectId, required: true },
    memberIds:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    leaderId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    generatedAt:      { type: Date, default: Date.now },
    groupSize:        { type: Number, required: true },
    options:          { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: false },
);

// Primary query: all history for an offering (also used, via $in, for the
// cross-offering pair-avoidance query scope).
groupHistorySchema.index({ courseOfferingId: 1, generatedAt: -1 });

module.exports = mongoose.model('GroupHistory', groupHistorySchema);
