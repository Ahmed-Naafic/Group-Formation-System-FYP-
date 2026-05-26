const Student = require('../models/Student');

const USER_FIELDS = 'studentId email role isActive mustChangePassword';

const studentRepository = {
  create(data) {
    return Student.create(data);
  },

  async findById(id) {
    return Student.findById(id).populate('userId', USER_FIELDS);
  },

  findAll(filter = {}) {
    return Student.find(filter).populate('userId', USER_FIELDS).sort({ fullName: 1 });
  },

  findOne(filter) {
    return Student.findOne(filter);
  },

  updateById(id, updates) {
    return Student.findByIdAndUpdate(id, updates, { new: true }).populate('userId', USER_FIELDS);
  },

  // Atomically sets hasBeenLeader and increments leaderCount in one operation.
  // Uses separate $set/$inc operators — cannot go through updateById's $set wrapper.
  markAsLeader(id) {
    return Student.findByIdAndUpdate(
      id,
      { $set: { hasBeenLeader: true }, $inc: { leaderCount: 1 } },
      { new: true },
    );
  },

};

module.exports = studentRepository;
