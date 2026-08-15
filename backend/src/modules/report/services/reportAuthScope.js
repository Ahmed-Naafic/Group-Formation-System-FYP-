const courseOfferingRepository     = require('../../courseOffering/repositories/courseOfferingRepository');
const instructorAssignmentService  = require('../../instructorAssignment/services/instructorAssignmentService');
const { ForbiddenError } = require('../../../common/errors');

// Every course offering the requester is allowed to see report data for.
// Admin: unrestricted (matches cohortService.getAll's existing admin scope).
// Instructor: only offerings they currently have an active assignment on —
// same source (instructorAssignmentService.getActiveOfferingIdsForInstructor)
// already used to scope the cohort list and the dashboard.
async function resolveAuthorizedOfferings(context) {
  if (context.role === 'admin') {
    return courseOfferingRepository.findAll({ status: 'active' });
  }
  if (context.role === 'instructor') {
    const offeringIds = await instructorAssignmentService.getActiveOfferingIdsForInstructor(context.userId);
    if (offeringIds.length === 0) return [];
    return courseOfferingRepository.findAll({ _id: { $in: offeringIds }, status: 'active' });
  }
  // Students never reach here — the route itself is admin/instructor only —
  // but fail closed rather than silently returning data if that ever changes.
  throw new ForbiddenError('You do not have access to reports');
}

// Narrows the authorized set by an optional courseOfferingId/cohortId filter
// from the request. This is the actual enforcement point for "an instructor
// must never access another instructor's data by changing an ID in the
// request" — a filter that doesn't match anything in the authorized set
// (whether because it belongs to someone else or doesn't exist at all)
// rejects the same way either way, so this never confirms or denies whether
// a given id exists to a caller who isn't allowed to see it.
async function resolveReportScope(context, { courseOfferingId, cohortId } = {}) {
  const authorized = await resolveAuthorizedOfferings(context);

  let scoped = authorized;
  if (courseOfferingId) {
    scoped = scoped.filter((o) => String(o._id) === String(courseOfferingId));
    if (scoped.length === 0) {
      throw new ForbiddenError('You do not have access to this course offering');
    }
  }
  if (cohortId) {
    scoped = scoped.filter((o) => String(o.cohortId?._id ?? o.cohortId) === String(cohortId));
    if (scoped.length === 0) {
      throw new ForbiddenError('You do not have access to this cohort');
    }
  }

  const courseOfferingIds = scoped.map((o) => o._id);
  const cohortIds = [...new Set(scoped.map((o) => String(o.cohortId?._id ?? o.cohortId)))];
  return { offerings: scoped, courseOfferingIds, cohortIds };
}

module.exports = { resolveAuthorizedOfferings, resolveReportScope };
