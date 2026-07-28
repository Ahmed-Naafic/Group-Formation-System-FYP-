const cohortRepository          = require('../repositories/cohortRepository');
const departmentService          = require('../../department/services/departmentService');
const courseOfferingRepository   = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, ConflictError } = require('../../../common/errors');

const cohortService = {
  getAll(filter = {}) {
    return cohortRepository.findAll(filter);
  },

  async getById(id) {
    const cohort = await cohortRepository.findById(id);
    if (!cohort) throw new NotFoundError('Cohort not found');
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
