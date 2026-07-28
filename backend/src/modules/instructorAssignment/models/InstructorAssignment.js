const mongoose = require('mongoose');

const instructorAssignmentSchema = new mongoose.Schema(
  {
    courseOfferingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    instructorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate:        { type: Date, required: true, default: Date.now },
    endDate:          { type: Date, default: null }, // null = currently active assignment
    assignedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason:           { type: String, trim: true, maxlength: 500, default: null },
  },
  { timestamps: true },
);

// Only one active (endDate: null) assignment per offering at a time.
instructorAssignmentSchema.index(
  { courseOfferingId: 1 },
  { unique: true, partialFilterExpression: { endDate: null } },
);

module.exports = mongoose.model('InstructorAssignment', instructorAssignmentSchema);
