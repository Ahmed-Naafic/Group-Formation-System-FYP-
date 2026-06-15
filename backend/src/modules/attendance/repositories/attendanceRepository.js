const Attendance = require('../models/Attendance');

const attendanceRepository = {
  create(data) {
    return Attendance.create(data);
  },

  findById(id) {
    return Attendance.findById(id);
  },

  // All active attendance records for one offering, with student name populated
  findByCourseOffering(courseOfferingId) {
    return Attendance.find({ courseOfferingId })
      .populate('studentId', 'fullName userId')
      .lean();
  },

  // Single-record lookup for upsert / uniqueness check
  findActiveByStudentAndOffering(studentId, courseOfferingId) {
    return Attendance.findOne({ studentId, courseOfferingId });
  },

  updateById(id, updates) {
    return Attendance.findByIdAndUpdate(id, updates, { new: true });
  },

  softDeleteAllByOffering(courseOfferingId, deletedBy) {
    const now = new Date();
    return Attendance.updateMany(
      { courseOfferingId, deletedAt: null },
      { $set: { deletedAt: now, deletedBy } },
    );
  },

  // Cascade-delete guard
  countByCourseOffering(courseOfferingId) {
    return Attendance.countDocuments({ courseOfferingId });
  },

  // Grouping engine: returns a studentId→percentage Map for one offering.
  // Students with no record default to 0 (handled by the caller).
  async getAttendanceMap(courseOfferingId) {
    const records = await Attendance.find({ courseOfferingId }).lean();
    return new Map(records.map((r) => [String(r.studentId), r.percentage]));
  },
};

module.exports = attendanceRepository;
