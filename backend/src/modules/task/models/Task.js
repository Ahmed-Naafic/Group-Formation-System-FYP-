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
    classId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Class',   required: true, index: true },
    assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
    assignedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    title:          { type: String, required: true, trim: true, maxlength: 200 },
    description:    { type: String, trim: true, maxlength: 5000 },
    attachments:    [attachmentSchema],
    deadline:       { type: Date },
    // 'open' accepts new/updated submissions; 'closed' locks them
    status:         { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true },
);

taskSchema.plugin(softDelete);

module.exports = mongoose.model('Task', taskSchema);
