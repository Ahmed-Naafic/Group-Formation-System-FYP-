const mongoose   = require('mongoose');
const softDelete = require('../../../common/plugins/softDelete');

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    url:          { type: String, required: true },
    publicId:     { type: String },
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
    submissionType:   { type: String, enum: ['group', 'individual'], default: 'group' },
    reminderSentAt:   { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.plugin(softDelete);

module.exports = mongoose.model('Task', taskSchema);
