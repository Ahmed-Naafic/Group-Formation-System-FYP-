const Class = require('../models/Class');

const classRepository = {
  create(data) {
    return Class.create(data);
  },

  findAll(filter = {}) {
    return Class.find(filter).populate('courseIds', 'name code').sort({ name: 1 });
  },

  findById(id) {
    return Class.findById(id).populate('courseIds', 'name code');
  },

  findOne(filter) {
    return Class.findOne(filter);
  },

  updateById(id, updates) {
    return Class.findByIdAndUpdate(id, updates, { new: true }).populate('courseIds', 'name code');
  },

  // Count active classes that include this course in their courseIds array.
  countByCourse(courseId) {
    return Class.countDocuments({ courseIds: courseId });
  },

  countBySemester(semesterId) {
    return Class.countDocuments({ semesterId });
  },

  findActiveByName(name) {
    return Class.findOne({ name });
  },
};

module.exports = classRepository;
