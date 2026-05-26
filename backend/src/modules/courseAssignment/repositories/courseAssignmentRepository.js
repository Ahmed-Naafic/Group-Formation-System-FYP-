const CourseAssignment = require('../models/CourseAssignment');

const POPULATE = [
  { path: 'classId',      select: 'name semesterId' },
  { path: 'courseId',     select: 'name code' },
  { path: 'instructorId', select: 'fullName email role' },
];

const courseAssignmentRepository = {
  create(data) {
    return CourseAssignment.create(data);
  },

  async findById(id) {
    return CourseAssignment.findById(id).populate(POPULATE);
  },

  findAll(filter = {}) {
    return CourseAssignment.find(filter).populate(POPULATE).sort({ createdAt: -1 });
  },

  findOne(filter) {
    return CourseAssignment.findOne(filter);
  },

  // Returns unique classIds an instructor is assigned to (for scope filtering)
  async distinctClassIds(instructorId) {
    const docs = await CourseAssignment.find({ instructorId }).select('classId');
    return [...new Set(docs.map((d) => d.classId.toString()))];
  },
};

module.exports = courseAssignmentRepository;
