const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const courseSchema = new mongoose.Schema(
  {
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Code is unique within a department, not globally
courseSchema.index({ departmentId: 1, code: 1 }, { unique: true });

// Name is also unique within a department among active records
courseSchema.index(
  { departmentId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

courseSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Course', courseSchema);
