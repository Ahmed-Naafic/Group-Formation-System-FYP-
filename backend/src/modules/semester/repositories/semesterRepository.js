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
};

module.exports = semesterRepository;
