const courseAssignmentRepository = require('../repositories/courseAssignmentRepository');
const classService   = require('../../class/services/classService');
const courseService  = require('../../course/services/courseService');
const userService    = require('../../user/services/userService');
const { NotFoundError, ForbiddenError, ConflictError, BadRequestError } = require('../../../common/errors');

const courseAssignmentService = {
  async create({ classId, courseId, instructorId }, createdBy) {
    // Validate referenced documents exist
    await classService.getById(classId);
    await courseService.getById(courseId);

    const instructor = await userService.findById(instructorId);
    if (!instructor) throw new NotFoundError('Instructor not found');
    if (instructor.role !== 'instructor') {
      throw new BadRequestError('The specified user is not an instructor');
    }

    // One instructor per course per class
    const existing = await courseAssignmentRepository.findOne({ classId, courseId });
    if (existing) {
      throw new ConflictError('This course already has an instructor assigned in this class');
    }

    const raw = await courseAssignmentRepository.create({ classId, courseId, instructorId, createdBy });
    return courseAssignmentRepository.findById(raw._id);
  },

  // Admin sees all; instructor sees only their own
  getAll(context) {
    const filter = context.role === 'instructor' ? { instructorId: context.userId } : {};
    return courseAssignmentRepository.findAll(filter);
  },

  async getById(id, context) {
    const assignment = await courseAssignmentRepository.findById(id);
    if (!assignment) throw new NotFoundError('Course assignment not found');

    if (context.role === 'instructor') {
      const ownerId = assignment.instructorId?._id?.toString() ?? assignment.instructorId?.toString();
      if (ownerId !== context.userId.toString()) {
        throw new ForbiddenError('You do not have access to this assignment');
      }
    }
    return assignment;
  },

  async remove(id, userId, context) {
    const assignment = await courseAssignmentService.getById(id, context);
    return assignment.softDelete(userId);
  },

  // ── Internal helpers used by other modules for RBAC scope checks ─────────────

  // Returns true if the instructor has an assignment for this class (and optionally course)
  async hasAccess(instructorId, classId, courseId) {
    const filter = { instructorId, classId };
    if (courseId) filter.courseId = courseId;
    const doc = await courseAssignmentRepository.findOne(filter);
    return !!doc;
  },

  // Returns distinct classIds the instructor is assigned to
  getInstructorClassIds(instructorId) {
    return courseAssignmentRepository.distinctClassIds(instructorId);
  },
};

module.exports = courseAssignmentService;
