const departmentRepository = require('../repositories/departmentRepository');
const facultyService = require('../../faculty/services/facultyService');
const { NotFoundError } = require('../../../common/errors');

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
    return department.softDelete(userId);
  },
};

module.exports = departmentService;
