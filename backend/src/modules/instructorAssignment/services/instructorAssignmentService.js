const instructorAssignmentRepository = require('../repositories/instructorAssignmentRepository');
const courseOfferingRepository       = require('../../courseOffering/repositories/courseOfferingRepository');
const userService                    = require('../../user/services/userService');
const auditLogService                = require('../../auditLog/services/auditLogService');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');

const instructorAssignmentService = {
  // Shared by offering creation and reassignment.
  async validateInstructor(instructorId) {
    const instructor = await userService.findById(instructorId);
    if (!instructor)                      throw new NotFoundError('Instructor user not found');
    if (instructor.role !== 'instructor') throw new BadRequestError('The specified user is not an instructor');
    if (!instructor.isActive)             throw new BadRequestError('Cannot assign a deactivated instructor');
    return instructor;
  },

  // First assignment for a newly created offering.
  async assign(courseOfferingId, instructorId, { assignedBy = null } = {}) {
    return instructorAssignmentRepository.create({
      courseOfferingId,
      instructorId,
      startDate: new Date(),
      endDate: null,
      assignedBy,
    });
  },

  // Core reassignment workflow: close the active assignment, open a new one,
  // and record the change in the audit log. No DB transactions are used
  // anywhere else in this codebase (see taskRepository.createMany's comment),
  // so partial failure is handled with a manual compensating action instead —
  // the same pattern groupService._persist/_rollback already uses.
  async reassign(courseOfferingId, newInstructorId, { assignedBy = null, reason = null } = {}, context) {
    const active = await instructorAssignmentRepository.findActiveByOffering(courseOfferingId);
    if (!active) throw new NotFoundError('No active instructor assignment found for this course offering');

    const currentInstructorId = String(active.instructorId?._id ?? active.instructorId);
    if (currentInstructorId === String(newInstructorId)) {
      throw new ConflictError('This instructor is already assigned to this course offering');
    }

    await instructorAssignmentService.validateInstructor(newInstructorId);

    const now = new Date();
    const closed = await instructorAssignmentRepository.closeActive(courseOfferingId, now);

    let created;
    try {
      created = await instructorAssignmentRepository.create({
        courseOfferingId,
        instructorId: newInstructorId,
        startDate: now,
        endDate: null,
        assignedBy,
        reason,
      });
    } catch (err) {
      // Compensate: reopen the assignment we just closed so the offering
      // never ends up with zero active instructors.
      await instructorAssignmentRepository.reopenActive(closed._id);
      throw err;
    }

    await auditLogService.log({
      actorId:    context?.userId,
      actorRole:  context?.role,
      ipAddress:  context?.ipAddress,
      userAgent:  context?.userAgent,
      action:     'INSTRUCTOR_REASSIGNED',
      entityKind: 'CourseOffering',
      entityId:   courseOfferingId,
      changes:    { from: currentInstructorId, to: String(newInstructorId), reason },
    });

    return created;
  },

  async getCurrentInstructorId(courseOfferingId) {
    const active = await instructorAssignmentRepository.findActiveByOffering(courseOfferingId);
    if (!active) return null;
    return active.instructorId?._id ?? active.instructorId;
  },

  // Attaches the currently-assigned instructor onto an offering (or array of
  // offerings) as `.instructorId`, matching the field name/shape every
  // existing caller (reportService, the frontend) already expects — this is
  // what lets the rest of the app keep reading `offering.instructorId`
  // without knowing the assignment now lives in a separate collection.
  async attachCurrentInstructor(offering) {
    if (!offering) return offering;
    const active = await instructorAssignmentRepository.findActiveByOffering(offering._id);
    const target = offering.toObject ? offering.toObject() : offering;
    target.instructorId = active?.instructorId ?? null;
    return target;
  },

  async attachCurrentInstructorMany(offerings) {
    if (!offerings.length) return offerings;
    const map = await instructorAssignmentRepository.findActiveMapForOfferings(offerings.map((o) => o._id));
    return offerings.map((o) => {
      const target = o.toObject ? o.toObject() : o;
      target.instructorId = map.get(String(o._id)) ?? null;
      return target;
    });
  },

  getActiveOfferingIdsForInstructor(instructorId) {
    return instructorAssignmentRepository.findActiveOfferingIdsForInstructor(instructorId);
  },

  // Used by the "does this instructor have access to this cohort" checks
  // duplicated across performanceService / enrollmentService / studentService.
  async hasActiveOfferingInCohort(instructorId, cohortId) {
    const offeringIds = await instructorAssignmentService.getActiveOfferingIdsForInstructor(instructorId);
    if (!offeringIds.length) return false;
    const offerings = await courseOfferingRepository.findAll({
      _id: { $in: offeringIds },
      cohortId,
      status: 'active',
    });
    return offerings.length > 0;
  },

  getHistory(courseOfferingId) {
    return instructorAssignmentRepository.findHistoryByOffering(courseOfferingId);
  },
};

module.exports = instructorAssignmentService;
