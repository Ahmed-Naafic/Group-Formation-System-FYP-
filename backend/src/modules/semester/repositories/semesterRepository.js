const Semester = require('../models/Semester');

const semesterRepository = {
  create(data) {
    return Semester.create(data);
  },

  findAll(filter = {}) {
    return Semester.find(filter).sort({ year: -1, startDate: -1 });
  },

  findById(id) {
    return Semester.findById(id);
  },

  updateById(id, updates) {
    return Semester.findByIdAndUpdate(id, updates, { new: true });
  },

  findActiveByNameAndYear(name, year) {
    return Semester.findOne({ name, year });
  },

  // Used by AcademicYear cascade-delete guard.
  // Returns 0 until Step 4 adds academicYearId to Semester documents.
  countByAcademicYear(academicYearId) {
    return Semester.countDocuments({ academicYearId });
  },
};

module.exports = semesterRepository;
