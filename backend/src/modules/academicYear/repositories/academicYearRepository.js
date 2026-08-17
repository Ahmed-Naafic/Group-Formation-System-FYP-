const AcademicYear = require('../models/AcademicYear');

const academicYearRepository = {
  create(data) {
    return AcademicYear.create(data);
  },

  findAll(filter = {}) {
    return AcademicYear.find(filter).sort({ startDate: -1 });
  },

  findById(id) {
    return AcademicYear.findById(id);
  },

  findActiveByName(name) {
    return AcademicYear.findOne({ name });
  },

  // The most recently-starting academic year — the anchor for both the
  // "only the next sequential year" rule and the "final month" creation
  // window. null when no academic years exist yet (first-ever bootstrap).
  findLatest() {
    return AcademicYear.findOne().sort({ startDate: -1 });
  },

  updateById(id, updates) {
    return AcademicYear.findByIdAndUpdate(id, updates, { new: true });
  },
};

module.exports = academicYearRepository;
