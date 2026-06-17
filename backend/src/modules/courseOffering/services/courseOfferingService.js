const courseOfferingRepository = require('../repositories/courseOfferingRepository');
const courseService            = require('../../course/services/courseService');
const cohortService            = require('../../cohort/services/cohortService');
const semesterService          = require('../../semester/services/semesterService');
const userService              = require('../../user/services/userService');
const groupRepository          = require('../../group/repositories/groupRepository');
const attendanceRepository     = require('../../attendance/repositories/attendanceRepository');
const { NotFoundError, BadRequestError, ConflictError, ForbiddenError } = require('../../../common/errors');

// Resolves and authorises access to an offering.
// Admin: unrestricted. Instructor: only their own offering.
async function resolveOffering(id, context) {
  const offering = await courseOfferingRepository.findById(id);
  if (!offering) throw new NotFoundError('Course offering not found');
  if (context.role === 'instructor') {
    const instructorId = String(offering.instructorId?._id ?? offering.instructorId);
    if (instructorId !== String(context.userId)) {
      throw new ForbiddenError('You are not the instructor for this course offering');
    }
  }
  return offering;
}

const courseOfferingService = {
  async getAll(filter = {}, context) {
    if (context.role === 'instructor') {
      return courseOfferingRepository.findAll({ ...filter, instructorId: context.userId });
    }
    return courseOfferingRepository.findAll(filter);
  },

  async getById(id, context) {
    return resolveOffering(id, context);
  },

  async create(data, context) {
    // Validate all referenced entities exist
    await courseService.getById(data.courseId);
    await cohortService.getById(data.cohortId);
    await semesterService.getById(data.semesterId);

    const instructor = await userService.findById(data.instructorId);
    if (!instructor)               throw new NotFoundError('Instructor user not found');
    if (instructor.role !== 'instructor') throw new BadRequestError('The specified user is not an instructor');
    if (!instructor.isActive)      throw new BadRequestError('Cannot assign a deactivated instructor');

    const duplicate = await courseOfferingRepository.findActiveByKey(
      data.courseId, data.cohortId, data.semesterId,
    );
    if (duplicate) {
      throw new ConflictError('This course is already offered to this cohort in this semester.');
    }

    return courseOfferingRepository.create({ ...data, createdBy: context.userId });
  },

  async update(id, updates, context) {
    if (context.role === 'instructor') throw new ForbiddenError('Only admins can update course offerings');
    // Existence check (admin bypass)
    const offering = await courseOfferingRepository.findById(id);
    if (!offering) throw new NotFoundError('Course offering not found');

    if (updates.instructorId) {
      const instructor = await userService.findById(updates.instructorId);
      if (!instructor)                    throw new NotFoundError('Instructor user not found');
      if (instructor.role !== 'instructor') throw new BadRequestError('The specified user is not an instructor');
      if (!instructor.isActive)             throw new BadRequestError('Cannot assign a deactivated instructor');
    }

    return courseOfferingRepository.updateById(id, updates);
  },

  async softDelete(id, userId, context) {
    if (context.role === 'instructor') throw new ForbiddenError('Only admins can delete course offerings');
    const offering = await courseOfferingRepository.findById(id);
    if (!offering) throw new NotFoundError('Course offering not found');

    const [groupCount, attendanceCount] = await Promise.all([
      groupRepository.countActiveByOffering(id),      // returns 0 until Step 6 populates courseOfferingId
      attendanceRepository.countByCourseOffering(id),
    ]);

    const parts = [];
    if (groupCount > 0)      parts.push(`${groupCount} active group(s)`);
    if (attendanceCount > 0) parts.push(`${attendanceCount} attendance record(s)`);
    if (parts.length > 0) {
      throw new ConflictError(
        `Cannot delete course offering — it has ${parts.join(' and ')}. Remove them first.`,
      );
    }

    return offering.softDelete(userId);
  },

  // Replacement for courseAssignmentService.hasAccess — used from Step 6 onwards.
  // Returns true if the instructor is assigned to the given offering.
  async hasAccess(instructorId, courseOfferingId) {
    const offering = await courseOfferingRepository.findActiveByIdAndInstructor(
      courseOfferingId, instructorId,
    );
    return !!offering;
  },
};

module.exports = courseOfferingService;
