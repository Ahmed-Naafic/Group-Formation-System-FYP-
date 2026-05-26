const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    groupId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Group',  required: true, index: true },
    taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task',   default: null },
    fromUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    toUserId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   default: null },
    toGroupId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Group',  default: null },
    rating:      { type: Number, min: 1, max: 5, required: true },
    comment:     { type: String, trim: true, maxlength: 2000 },
    isPeer:      { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Prevent duplicate feedback from the same user to the same target for the same task
feedbackSchema.index({ taskId: 1, fromUserId: 1, toUserId: 1, toGroupId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
