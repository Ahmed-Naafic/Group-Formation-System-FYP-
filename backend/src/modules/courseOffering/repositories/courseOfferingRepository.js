const CourseOffering = require('../models/CourseOffering');

// instructorId is intentionally not populated here — it's not a field on
// this model. The current instructor is attached separately by
// instructorAssignmentService.attachCurrentInstructor(Many) from the
// InstructorAssignment ledger.
const POPULATE = [
  { path: 'courseId',   select: 'name code departmentId' },
  { path: 'cohortId',   select: 'name departmentId' },
  { path: 'semesterId', select: 'name startDate endDate status' },
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

  // Grouping engine + student scoping: all offerings for a cohort
  findByCohort(cohortId) {
    return CourseOffering.find({ cohortId }).lean();
  },

};

module.exports = courseOfferingRepository;
