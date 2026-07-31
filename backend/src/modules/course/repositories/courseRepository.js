const Course = require('../models/Course');

const courseRepository = {
  create(data) {
    return Course.create(data);
  },

  findAll(filter = {}) {
    return Course.find(filter).sort({ code: 1 });
  },

  findById(id) {
    return Course.findById(id);
  },

  findOne(filter) {
    return Course.findOne(filter);
  },

  updateById(id, updates) {
    return Course.findByIdAndUpdate(id, updates, { new: true });
  },

  countByDepartment(departmentId) {
    return Course.countDocuments({ departmentId });
  },

  findActiveByNameAndDepartment(name, departmentId) {
    return Course.findOne({ name, departmentId }).collation({ locale: 'en', strength: 2 });
  },
};

module.exports = courseRepository;
