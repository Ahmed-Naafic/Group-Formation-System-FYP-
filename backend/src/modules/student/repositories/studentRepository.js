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

  // Count students whose stored scores exceed the given maxMarks thresholds.
  // Used to warn admins after a maxMarks reduction without touching stored data.
  countExceedingScores(maxMarks) {
    return Student.countDocuments({
      $or: [
        { 'scores.midterm':    { $gt: maxMarks.midterm    } },
        { 'scores.final':      { $gt: maxMarks.final      } },
        { 'scores.coursework': { $gt: maxMarks.coursework } },
      ],
    });
  },
};

module.exports = studentRepository;
