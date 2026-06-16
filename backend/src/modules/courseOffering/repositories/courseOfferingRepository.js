const CourseOffering = require('../models/CourseOffering');

const POPULATE = [
  { path: 'courseId',     select: 'name code departmentId' },
  { path: 'cohortId',     select: 'name departmentId yearOfEntry' },
  { path: 'semesterId',   select: 'name startDate endDate status' },
  { path: 'instructorId', select: 'fullName email isActive' },
];

const courseOfferingRepository = {
  create(data) {
    return CourseOffering.create(data);
  },

  findAll(filter = {}) {
    return CourseOffering.find(filter).populate(POPULATE).sort({ createdAt: -1 });
  },

  findById(id) {
    return CourseOffering.findById(id).populate(POPULATE);
  },

  // Uniqueness check: one active offering per (course, cohort, semester)
  findActiveByKey(courseId, cohortId, semesterId) {
    return CourseOffering.findOne({ courseId, cohortId, semesterId });
  },

  updateById(id, updates) {
    return CourseOffering.findByIdAndUpdate(id, updates, { new: true }).populate(POPULATE);
  },

  // Cascade-delete counts
  countByCohort(cohortId) {
    return CourseOffering.countDocuments({ cohortId });
  },

  countBySemester(semesterId) {
    return CourseOffering.countDocuments({ semesterId });
  },

  countByCourse(courseId) {
    return CourseOffering.countDocuments({ courseId });
  },

  // Access check: is this instructor the instructor for this offering?
  findActiveByIdAndInstructor(offeringId, instructorId) {
    return CourseOffering.findOne({ _id: offeringId, instructorId });
  },

  // Grouping engine + student scoping: all offerings for a cohort
  findByCohort(cohortId) {
    return CourseOffering.find({ cohortId }).lean();
  },
};

module.exports = courseOfferingRepository;
