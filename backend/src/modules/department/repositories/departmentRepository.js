const Department = require('../models/Department');

const departmentRepository = {
  create(data) {
    return Department.create(data);
  },

  findAll(filter = {}) {
    return Department.find(filter).sort({ name: 1 });
  },

  findById(id) {
    return Department.findById(id);
  },

  findOne(filter) {
    return Department.findOne(filter);
  },

  updateById(id, updates) {
    return Department.findByIdAndUpdate(id, updates, { new: true });
  },

  countByFaculty(facultyId) {
    return Department.countDocuments({ facultyId });
  },
};

module.exports = departmentRepository;
