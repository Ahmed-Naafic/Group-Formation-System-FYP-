const mongoose   = require('mongoose');
const softDelete = require('../../../common/plugins/softDelete');

const readReceiptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// One reaction per user per message — setting a new emoji replaces the
// previous one, tapping the same emoji again removes it. Enforced in
// messageRepository.setReaction, not at the schema level.
const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji:  { type: String, required: true },
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
    reactions:   [reactionSchema],
    replyTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    readBy:      [readReceiptSchema],
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // content itself is never edited, only (soft-)deleted
  },
);

messageSchema.plugin(softDelete);

// Compound index for efficient paginated queries — includes deletedAt since
// the softDelete plugin's query middleware injects that filter on every find.
messageSchema.index({ workspaceId: 1, deletedAt: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

