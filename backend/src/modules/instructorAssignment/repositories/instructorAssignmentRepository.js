const InstructorAssignment = require('../models/InstructorAssignment');

const INSTRUCTOR_SELECT   = 'fullName email isActive';
const ASSIGNED_BY_SELECT  = 'fullName email';

const instructorAssignmentRepository = {
  create(data) {
    return InstructorAssignment.create(data);
  },

  findActiveByOffering(courseOfferingId) {
    return InstructorAssignment.findOne({ courseOfferingId, endDate: null })
      .populate('instructorId', INSTRUCTOR_SELECT);
  },

  // Bulk lookup — returns Map<offeringId, populated instructor doc>.
  async findActiveMapForOfferings(courseOfferingIds) {
    const records = await InstructorAssignment.find({
      courseOfferingId: { $in: courseOfferingIds },
      endDate: null,
    }).populate('instructorId', INSTRUCTOR_SELECT);

    const map = new Map();
    for (const r of records) map.set(String(r.courseOfferingId), r.instructorId);
    return map;
  },

  async findActiveOfferingIdsForInstructor(instructorId) {
    const records = await InstructorAssignment.find(
      { instructorId, endDate: null },
      'courseOfferingId',
    ).lean();
    return records.map((r) => r.courseOfferingId);
  },

  closeActive(courseOfferingId, endDate) {
    return InstructorAssignment.findOneAndUpdate(
      { courseOfferingId, endDate: null },
      { $set: { endDate } },
      { new: true },
    );
  },

  // Rollback helper for reassign() — reopens the record just closed if the
  // follow-up create() fails, so the offering never ends up with zero
  // active assignments.
  reopenActive(assignmentId) {
    return InstructorAssignment.findByIdAndUpdate(assignmentId, { $set: { endDate: null } });
  },

  findHistoryByOffering(courseOfferingId) {
    return InstructorAssignment.find({ courseOfferingId })
      .populate('instructorId', INSTRUCTOR_SELECT)
      .populate('assignedBy', ASSIGNED_BY_SELECT)
      .sort({ startDate: -1 });
  },

  existsForInstructor(instructorId) {
    return InstructorAssignment.exists({ instructorId });
  },
};

module.exports = instructorAssignmentRepository;
