const mongoose    = require('mongoose');
const softDelete  = require('../../../common/plugins/softDelete');

const workspaceSchema = new mongoose.Schema(
  {
    groupId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, unique: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

workspaceSchema.plugin(softDelete);

module.exports = mongoose.model('Workspace', workspaceSchema);
