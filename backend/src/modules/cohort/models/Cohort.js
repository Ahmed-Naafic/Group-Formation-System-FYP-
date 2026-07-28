const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const cohortSchema = new mongoose.Schema(
  {
    // Always normalized to uppercase on write (create and findOneAndUpdate/
    // findByIdAndUpdate both apply this cast) — "ca226"/"Ca226"/"CA226" all
    // store as "CA226". The collation below is defense in depth for any path
    // that bypasses this cast (e.g. a raw driver write).
    name:         { type: String, required: true, trim: true, uppercase: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    description:  { type: String, trim: true, default: '' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Name unique across the whole system (not just within a department), and
// case-insensitive — "CA226" and "ca226" collide. Only enforced among active
// (non-deleted) cohorts, so a deleted cohort's name can be reused.
cohortSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { deletedAt: null },
  },
);

cohortSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Cohort', cohortSchema);
