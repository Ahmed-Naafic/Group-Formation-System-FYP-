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

semesterSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Semester', semesterSchema);
