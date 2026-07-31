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

  // Case-insensitive — matches the unique index's collation. Soft-deleted
  // departments are excluded by the softDelete plugin's query middleware.
  findByFacultyAndName(facultyId, name) {
    return Department.findOne({ facultyId, name }).collation({ locale: 'en', strength: 2 });
  },

  updateById(id, updates) {
    return Department.findByIdAndUpdate(id, updates, { new: true });
  },

  countByFaculty(facultyId) {
    return Department.countDocuments({ facultyId });
  },
};

module.exports = departmentRepository;
