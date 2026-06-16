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

  updateById(id, updates) {
    return AcademicYear.findByIdAndUpdate(id, updates, { new: true });
  },
};

module.exports = academicYearRepository;
