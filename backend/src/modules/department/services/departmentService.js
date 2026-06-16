const departmentRepository = require('../repositories/departmentRepository');
const facultyService       = require('../../faculty/services/facultyService');
const courseRepository     = require('../../course/repositories/courseRepository');
const cohortRepository     = require('../../cohort/repositories/cohortRepository');
const { NotFoundError, ConflictError } = require('../../../common/errors');

const departmentService = {
  async create(data) {
    // Enforce hierarchy — faculty must exist
    await facultyService.getById(data.facultyId);
    return departmentRepository.create(data);
  },

  getAll(filter = {}) {
    return departmentRepository.findAll(filter);
  },

  async getById(id) {
    const department = await departmentRepository.findById(id);
    if (!department) throw new NotFoundError('Department not found');
    return department;
  },

  async update(id, updates) {
    if (updates.facultyId) {
      await facultyService.getById(updates.facultyId);
    }
    await departmentService.getById(id);
    return departmentRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const department = await departmentService.getById(id);
    const [courseCount, cohortCount] = await Promise.all([
      courseRepository.countByDepartment(id),
      cohortRepository.countByDepartment(id),
    ]);
    const parts = [];
    if (courseCount > 0) parts.push(`${courseCount} course(s)`);
    if (cohortCount > 0) parts.push(`${cohortCount} cohort(s)`);
    if (parts.length > 0) {
      throw new ConflictError(
        `Cannot delete department — it has ${parts.join(' and ')}. Delete them first.`,
      );
    }
    return department.softDelete(userId);
  },
};

module.exports = departmentService;
