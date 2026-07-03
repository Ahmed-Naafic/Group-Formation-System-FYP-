const mongoose   = require('mongoose');
const softDelete = require('../../../common/plugins/softDelete');

const fileSchema = new mongoose.Schema(
  {
    workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
    originalName: { type: String, required: true, trim: true },
    url:          { type: String, required: true },   // Cloudinary CDN URL
    publicId:     { type: String, required: true },   // Cloudinary public_id (for deletion)
    mimeType:     { type: String, required: true },
    sizeBytes:    { type: Number, required: true },
    uploadedAt:   { type: Date,   default: Date.now },
  },
  {
    timestamps: false, // uploadedAt covers creation; no updates
  },
);

fileSchema.plugin(softDelete);

module.exports = mongoose.model('File', fileSchema);
