const mongoose = require('mongoose');
const softDeletePlugin = require('../../../common/plugins/softDelete');

const courseAssignmentSchema = new mongoose.Schema(
  {
    classId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class',  required: true },
    courseId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  },
  { timestamps: true }
);

// One instructor per course per class — partial index excludes soft-deleted docs
courseAssignmentSchema.index(
  { classId: 1, courseId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

courseAssignmentSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('CourseAssignment', courseAssignmentSchema);
