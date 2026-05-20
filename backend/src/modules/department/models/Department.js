const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const departmentSchema = new mongoose.Schema(
  {
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Name is unique within a faculty, not globally
departmentSchema.index({ facultyId: 1, name: 1 }, { unique: true });

departmentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Department', departmentSchema);
