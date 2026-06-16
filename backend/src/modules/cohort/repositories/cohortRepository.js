const Cohort = require('../models/Cohort');

const cohortRepository = {
  create(data) {
    return Cohort.create(data);
  },

  findAll(filter = {}) {
    return Cohort.find(filter)
      .populate('departmentId', 'name facultyId')
      .sort({ name: 1 });
  },

  findById(id) {
    return Cohort.findById(id).populate('departmentId', 'name facultyId');
  },

  findActiveByNameAndDepartment(name, departmentId) {
    return Cohort.findOne({ name, departmentId });
  },

  updateById(id, updates) {
    return Cohort.findByIdAndUpdate(id, updates, { new: true })
      .populate('departmentId', 'name facultyId');
  },

  countByDepartment(departmentId) {
    return Cohort.countDocuments({ departmentId });
  },
};

module.exports = cohortRepository;
