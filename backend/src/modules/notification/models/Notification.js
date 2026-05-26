const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:    { type: String, required: true }, // GROUP_FORMED | TASK_ASSIGNED | SUBMISSION_GRADED | ...
    title:   { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    relatedEntity: {
      kind: { type: String },
      id:   { type: mongoose.Schema.Types.ObjectId },
    },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date,    default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

module.exports = mongoose.model('Notification', notificationSchema);
