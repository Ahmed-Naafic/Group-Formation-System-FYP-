const Semester = require('../models/Semester');

const semesterRepository = {
  create(data) {
    return Semester.create(data);
  },

  findAll(filter = {}) {
    return Semester.find(filter)
      .populate('academicYearId', 'name')
      .sort({ startDate: -1 });
  },

  findById(id) {
    return Semester.findById(id).populate('academicYearId', 'name');
  },

  updateById(id, updates) {
    return Semester.findByIdAndUpdate(id, updates, { new: true });
  },

  // Active (non-deleted) semesters in an academic year — used to derive the
  // next "Semester N" name and to check duration/overlap against siblings.
  findActiveByAcademicYear(academicYearId) {
    return Semester.find({ academicYearId }).sort({ startDate: 1 });
  },

  // Used by AcademicYear cascade-delete guard.
  countByAcademicYear(academicYearId) {
    return Semester.countDocuments({ academicYearId, deletedAt: null });
  },
};

module.exports = semesterRepository;
