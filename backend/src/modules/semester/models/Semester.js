const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

// A Semester here means "the Course Offering period within an Academic
// Year" — NOT a student's program/degree semester (see semesterRules.js's
// header comment for the full distinction). Every Academic Year has exactly
// 10 of these (numbered 1-10), auto-created alongside it — there are no
// individual per-semester dates; the Academic Year's own startDate/endDate
// is the only real date range. `name` ("Semester N") is kept for display/
// backward-compatibility with everything that already reads it (Course
// Offering lists, reports) — it's always derived from `number`, never
// client-supplied.
const semesterSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    number:         { type: Number, required: true, min: 1, max: 10 },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Exactly one "Semester N" per academic year — this is what guarantees no
// Semester 11 and no duplicate numbers can ever exist for the same year.
semesterSchema.index(
  { academicYearId: 1, number: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

semesterSchema.plugin(softDeletePlugin);

// FIRST_GROUP = {1,3,5,7,9} (odd), SECOND_GROUP = {2,4,6,8,10} (even) — fixed
// classification, not derived from any date. Computed live rather than
// stored so it can never drift from `number`.
semesterSchema.virtual('sixMonthGroup').get(function () {
  return this.number % 2 === 1 ? 'FIRST' : 'SECOND';
});
semesterSchema.set('toJSON',   { virtuals: true });
semesterSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Semester', semesterSchema);
