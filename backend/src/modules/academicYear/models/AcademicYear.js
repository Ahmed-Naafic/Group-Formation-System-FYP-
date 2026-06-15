const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const academicYearSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    status:    { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Name must be globally unique among active records (e.g. "2025/2026" cannot exist twice).
academicYearSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

academicYearSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('AcademicYear', academicYearSchema);
