const User = require('../models/User');

const userRepository = {
  findById(id) {
    return User.findById(id);
  },

  findByIdWithPassword(id) {
    return User.findById(id).select('+passwordHash');
  },

  findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  },

  findByEmailWithPassword(email) {
    return User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  },

  findByStudentId(studentId) {
    return User.findOne({ studentId });
  },

  findByStudentIdWithPassword(studentId) {
    return User.findOne({ studentId }).select('+passwordHash');
  },

  create(data) {
    return User.create(data);
  },

  updateById(id, updates) {
    return User.findByIdAndUpdate(id, updates, { new: true });
  },

  existsWithRole(role) {
    return User.exists({ role });
  },
};

module.exports = userRepository;
