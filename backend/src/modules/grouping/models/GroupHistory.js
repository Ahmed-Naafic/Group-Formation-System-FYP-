const mongoose = require('mongoose');

// One document per group per generation run.
// classId + generationId link all groups from a single generate/regenerate call.
// No soft-delete — history is an immutable audit record.
const groupHistorySchema = new mongoose.Schema(
  {
    classId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: true },
    courseId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course',  required: true },
    generationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    memberIds:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    leaderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    generatedAt:  { type: Date, default: Date.now },
    groupSize:    { type: Number, required: true },
    options:      { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: false },
);

groupHistorySchema.index({ classId: 1, courseId: 1, generatedAt: -1 });

module.exports = mongoose.model('GroupHistory', groupHistorySchema);
