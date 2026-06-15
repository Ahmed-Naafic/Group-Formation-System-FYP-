const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Same semester name allowed in different years ("Semester 1" in 2026 and 2027),
// but not the same name+year combination.
semesterSchema.index(
  { name: 1, year: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

semesterSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Semester', semesterSchema);
