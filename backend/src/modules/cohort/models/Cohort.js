const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const cohortSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    yearOfEntry:  { type: Number, default: null },
    description:  { type: String, trim: true, default: '' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Name unique within a department — "CA226" can exist in two departments, not twice in one.
cohortSchema.index(
  { departmentId: 1, name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

cohortSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Cohort', cohortSchema);
