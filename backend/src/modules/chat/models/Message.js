const mongoose = require('mongoose');

const readReceiptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
    content:     { type: String, default: '', maxlength: 4000, trim: true },
    attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
    // Voice message fields. The bucket is private (confirmed against the real
    // Supabase project), so we store the storage path and resolve a fresh
    // signed URL per playback request rather than baking in a URL that expires.
    audioPublicId:   { type: String, default: null },
    audioDuration:   { type: Number, default: null }, // seconds
    audioSizeBytes:  { type: Number, default: null },
    readBy:      [readReceiptSchema],
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // messages are immutable
  },
);

// Compound index for efficient paginated queries
messageSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

