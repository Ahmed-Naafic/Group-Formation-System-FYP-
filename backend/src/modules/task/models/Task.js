const mongoose   = require('mongoose');
const softDelete = require('../../../common/plugins/softDelete');

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storageKey:   { type: String, required: true },
    mimeType:     { type: String, required: true },
    sizeBytes:    { type: Number, required: true },
  },
  { _id: false },
);

const taskSchema = new mongoose.Schema(
  {
    courseOfferingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', required: true, index: true },
    assignedGroups:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    assignedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:            { type: String, required: true, trim: true, maxlength: 200 },
    description:      { type: String, trim: true, maxlength: 5000 },
    attachments:      [attachmentSchema],
    deadline:         { type: Date },
    status:           { type: String, enum: ['open', 'closed'], default: 'open' },
    reminderSentAt:   { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.plugin(softDelete);

module.exports = mongoose.model('Task', taskSchema);
