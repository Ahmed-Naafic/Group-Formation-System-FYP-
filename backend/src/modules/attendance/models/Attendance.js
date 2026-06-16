const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

// One record per student per course offering. Use PATCH to update; POST /bulk to upsert a batch.
// No timestamps — updatedBy field carries the audit trail.
const attendanceSchema = new mongoose.Schema(
  {
    studentId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Student',        required: true },
    courseOfferingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    percentage:       { type: Number, min: 0, max: 100, required: true },
    updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',           required: true },
  },
  { timestamps: false },
);

// One active attendance record per (student, offering).
attendanceSchema.index(
  { studentId: 1, courseOfferingId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

// Query index: fetch all attendance records for one offering quickly.
attendanceSchema.index({ courseOfferingId: 1 });

attendanceSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('Attendance', attendanceSchema);
