const cohortRepository          = require('../repositories/cohortRepository');
const departmentService          = require('../../department/services/departmentService');
const courseOfferingRepository   = require('../../courseOffering/repositories/courseOfferingRepository');
// The repository, not instructorAssignmentService — that service imports
// userService, which already imports this module, and going through the
// service here would create a require cycle (cohortService ->
// instructorAssignmentService -> userService -> cohortService), leaving
// userService's cached cohortService reference incomplete.
const instructorAssignmentRepository = require('../../instructorAssignment/repositories/instructorAssignmentRepository');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../../common/errors');

const cohortService = {
  // Admin sees every cohort (optionally scoped by departmentId, as before).
  // Instructor sees only cohorts that have an active course offering they're
  // currently assigned to — previously this returned every cohort in the
  // system regardless of role, which is the "instructor can see cohorts
  // they're not assigned to" bug.
  async getAll(filter = {}, context) {
    if (context?.role !== 'instructor') {
      return cohortRepository.findAll(filter);
    }

    const offeringIds = await instructorAssignmentRepository.findActiveOfferingIdsForInstructor(context.userId);
    if (offeringIds.length === 0) return [];

    const offerings = await courseOfferingRepository.findAll({
      _id: { $in: offeringIds },
      status: 'active',
    });
    const cohortIds = [...new Set(offerings.map((o) => String(o.cohortId?._id ?? o.cohortId)))];
    if (cohortIds.length === 0) return [];

    return cohortRepository.findAll({ ...filter, _id: { $in: cohortIds } });
  },

  async getById(id) {
    const cohort = await cohortRepository.findById(id);
    if (!cohort) throw new NotFoundError('Cohort not found');
    return cohort;
  },

  // Same scoping as getAll, applied to a single cohort — used by the direct
  // GET /:id route so an instructor can't view a cohort's detail just by
  // knowing/guessing its id. Kept separate from getById itself: that method
  // is called internally by several already-guarded flows (transfers,
  // offering creation, etc.) that intentionally fetch a cohort without an
  // access check of their own, and adding one here would break them.
  async getByIdForRole(id, context) {
    const cohort = await cohortService.getById(id);
    if (context?.role === 'instructor') {
      const offeringIds = await instructorAssignmentRepository.findActiveOfferingIdsForInstructor(context.userId);
      const hasAccess = offeringIds.length > 0 && await courseOfferingRepository.findAll({
        _id: { $in: offeringIds },
        cohortId: id,
        status: 'active',
      }).then((offerings) => offerings.length > 0);
      if (!hasAccess) throw new ForbiddenError('You do not have access to this cohort');
    }
    return cohort;
  },

  async create(data) {
    await departmentService.getById(data.departmentId);
    const duplicate = await cohortRepository.findActiveByName(data.name);
    if (duplicate) {
      throw new ConflictError('A cohort with this name already exists.');
    }
    return cohortRepository.create(data);
  },

  async update(id, updates) {
    const cohort = await cohortService.getById(id);
    if (updates.departmentId) await departmentService.getById(updates.departmentId);
    if (updates.name) {
      const duplicate = await cohortRepository.findActiveByName(updates.name);
      if (duplicate && String(duplicate._id) !== id) {
        throw new ConflictError('A cohort with this name already exists.');
      }
    }
    return cohortRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const cohort = await cohortService.getById(id);
    const offeringCount = await courseOfferingRepository.countByCohort(id);
    // Note: student enrollment check (Student.cohortId) is added in Step 5
    if (offeringCount > 0) {
      throw new ConflictError(
        `Cannot delete cohort — it has ${offeringCount} active course offering(s). Remove them first.`,
      );
    }
    return cohort.softDelete(userId);
  },
};

module.exports = cohortService;
