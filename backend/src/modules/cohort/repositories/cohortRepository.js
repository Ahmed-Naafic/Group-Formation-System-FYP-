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

  // Global, case-insensitive — cohort names must be unique across the whole
  // system, not just within a department. The collation must match the one
  // on the unique index (see Cohort.js) for both to agree on equality.
  findActiveByName(name) {
    return Cohort.findOne({ name }).collation({ locale: 'en', strength: 2 });
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
