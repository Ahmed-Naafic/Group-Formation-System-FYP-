const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

facultySchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Faculty', facultySchema);
