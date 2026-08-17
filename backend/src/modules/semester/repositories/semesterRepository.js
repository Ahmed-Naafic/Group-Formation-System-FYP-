const Semester = require('../models/Semester');

const semesterRepository = {
  // Bulk-inserts the 10 default semester docs for a freshly created academic
  // year in one round trip.
  insertMany(docs) {
    return Semester.insertMany(docs);
  },

  findAll(filter = {}) {
    return Semester.find(filter)
      .populate('academicYearId', 'name')
      .sort({ academicYearId: -1, number: 1 });
  },

  findById(id) {
    return Semester.findById(id).populate('academicYearId', 'name');
  },

  // The 10 semesters for one academic year, in number order (1-10).
  findByAcademicYear(academicYearId) {
    return Semester.find({ academicYearId }).sort({ number: 1 });
  },

  // Used by AcademicYear's cascade-delete guard — but since every academic
  // year always has its 10 default semesters, this alone no longer signals
  // "has historical data"; academicYearService checks course offerings
  // against these semesters instead. Kept for read/count use elsewhere.
  countByAcademicYear(academicYearId) {
    return Semester.countDocuments({ academicYearId, deletedAt: null });
  },
};

module.exports = semesterRepository;
