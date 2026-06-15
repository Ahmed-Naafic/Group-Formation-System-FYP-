const mongoose   = require('mongoose');
const softDelete = require('../../../common/plugins/softDelete');

const groupSchema = new mongoose.Schema(
  {
    courseOfferingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    name:      { type: String, required: true, trim: true },
    leaderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],

    generatedAt:       { type: Date, default: Date.now },
    generationId:      { type: mongoose.Schema.Types.ObjectId, required: true },
    generationOptions: { type: mongoose.Schema.Types.Mixed, default: {} },

    status:    { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

groupSchema.plugin(softDelete);
groupSchema.index({ courseOfferingId: 1, status: 1 });

module.exports = mongoose.model('Group', groupSchema);
