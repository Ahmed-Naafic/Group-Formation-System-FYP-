const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const courseOfferingSchema = new mongoose.Schema(
  {
    courseId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course',   required: true },
    cohortId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort',   required: true },
    semesterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    maxStudents:  { type: Number, min: 1, default: null },
    status:       { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  },
  { timestamps: true },
);

// A course can only be offered to a cohort once per semester among active records.
// The same course can be offered to the same cohort in different semesters (different academic years).
courseOfferingSchema.index(
  { courseId: 1, cohortId: 1, semesterId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

courseOfferingSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('CourseOffering', courseOfferingSchema);
