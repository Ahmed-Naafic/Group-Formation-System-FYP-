const courseOfferingRepository = require('../repositories/courseOfferingRepository');
const courseService = require('../../course/services/courseService');
const cohortService = require('../../cohort/services/cohortService');
const semesterService = require('../../semester/services/semesterService');
const groupRepository = require('../../group/repositories/groupRepository');
const attendanceRepository = require('../../attendance/repositories/attendanceRepository');
const instructorAssignmentService = require('../../instructorAssignment/services/instructorAssignmentService');
const { NotFoundError, ConflictError, ForbiddenError } = require('../../../common/errors');

// Resolves and authorises access to an offering.
// Admin: unrestricted. Instructor: only the offering they are CURRENTLY
// assigned to — resolved from InstructorAssignment (endDate: null), never a
// stored field, so a reassigned-away instructor loses access immediately.
async function resolveOffering(id, context) {
  const offering = await courseOfferingRepository.findById(id);
  if (!offering) throw new NotFoundError('Course offering not found');

  const currentInstructorId = await instructorAssignmentService.getCurrentInstructorId(id);
  if (context.role === 'instructor') {
    if (String(currentInstructorId ?? '') !== String(context.userId)) {
      throw new ForbiddenError('You are not the instructor for this course offering');
    }
  }
  return instructorAssignmentService.attachCurrentInstructor(offering);
}

const courseOfferingService = {
  async getAll(filter = {}, context) {
    let offerings;
    if (context.role === 'instructor') {
      const offeringIds = await instructorAssignmentService.getActiveOfferingIdsForInstructor(context.userId);
      offerings = await courseOfferingRepository.findAll({ ...filter, _id: { $in: offeringIds } });
    } else {
      offerings = await courseOfferingRepository.findAll(filter);
    }
    return instructorAssignmentService.attachCurrentInstructorMany(offerings);
  },

  async getById(id, context) {
    return resolveOffering(id, context);
  },

  async create(data, context) {
    // Validate all referenced entities exist
    await courseService.getById(data.courseId);
    await cohortService.getById(data.cohortId);
    const semester = await semesterService.getById(data.semesterId);
    await instructorAssignmentService.validateInstructor(data.instructorId);

    // Cross-check: the selected semester must actually belong to the
    // selected academic year — the UI resolves this via a cascading
    // dropdown, but a direct API call could send a mismatched pair.
    // academicYearId itself is never stored on the offering; semesterId
    // alone already fully implies it.
    if (data.academicYearId) {
      const semesterAyId = String(semester.academicYearId?._id ?? semester.academicYearId);
      if (semesterAyId !== String(data.academicYearId)) {
        throw new ConflictError('The selected semester does not belong to the selected academic year.');
      }
    }

    const duplicate = await courseOfferingRepository.findActiveByKey(
      data.courseId, data.cohortId, data.semesterId,
    );
    if (duplicate) {
      throw new ConflictError('This course is already offered to this cohort in this semester.');
    }

    const { instructorId, academicYearId, ...offeringData } = data;
    const offering = await courseOfferingRepository.create({ ...offeringData, createdBy: context.userId });
    await instructorAssignmentService.assign(offering._id, instructorId, { assignedBy: context.userId });

    return instructorAssignmentService.attachCurrentInstructor(offering);
  },

  async update(id, updates, context) {
    if (context.role === 'instructor') throw new ForbiddenError('Only admins can update course offerings');
    // Existence check (admin bypass)
    const offering = await courseOfferingRepository.findById(id);
    if (!offering) throw new NotFoundError('Course offering not found');

    const { instructorId: newInstructorId, reason, ...rest } = updates;

    if (newInstructorId) {
      const currentInstructorId = await instructorAssignmentService.getCurrentInstructorId(id);
      if (String(currentInstructorId ?? '') !== String(newInstructorId)) {
        await instructorAssignmentService.reassign(
          id, newInstructorId, { assignedBy: context.userId, reason: reason ?? null }, context,
        );
      }
    }

    const updated = Object.keys(rest).length
      ? await courseOfferingRepository.updateById(id, rest)
      : await courseOfferingRepository.findById(id);
    return instructorAssignmentService.attachCurrentInstructor(updated);
  },

  // Read-only history of every instructor this offering has ever had — for
  // auditing/reporting only. Access is gated by the same resolveOffering()
  // rule as getById, so an instructor who has since been reassigned away
  // loses visibility here too, same as everywhere else.
  async getInstructorHistory(id, context) {
    await resolveOffering(id, context);
    return instructorAssignmentService.getHistory(id);
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

  // Returns true if the instructor is CURRENTLY assigned to the given offering.
  async hasAccess(instructorId, courseOfferingId) {
    const currentInstructorId = await instructorAssignmentService.getCurrentInstructorId(courseOfferingId);
    return String(currentInstructorId ?? '') === String(instructorId);
  },
};

module.exports = courseOfferingService;
