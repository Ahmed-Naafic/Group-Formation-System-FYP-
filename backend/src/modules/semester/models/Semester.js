const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const semesterSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, required: true },
    status:         { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// "Semester 1" can exist in 2025/2026 and again in 2026/2027 — but not twice within the same year.
// NOTE: drop the old { name, year } index manually before first restart on this schema.
semesterSchema.index(
  { name: 1, academicYearId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

semesterSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Semester', semesterSchema);
