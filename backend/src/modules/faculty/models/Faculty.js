const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const facultySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

facultySchema.plugin(softDeletePlugin);

// Case-insensitive ("Engineering" and "engineering" collide) and only
// enforced among active (non-deleted) faculties, so a deleted faculty's name
// can be reused — same pattern as Cohort's name index.
facultySchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { deletedAt: null },
  },
);

module.exports = mongoose.model('Faculty', facultySchema);
