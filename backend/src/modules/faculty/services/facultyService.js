const facultyRepository    = require('../repositories/facultyRepository');
const departmentRepository = require('../../department/repositories/departmentRepository');
const { NotFoundError, ConflictError } = require('../../../common/errors');

const facultyService = {
  create(data) {
    return facultyRepository.create(data);
  },

  getAll() {
    return facultyRepository.findAll();
  },

  async getById(id) {
    const faculty = await facultyRepository.findById(id);
    if (!faculty) throw new NotFoundError('Faculty not found');
    return faculty;
  },

  async update(id, updates) {
    await facultyService.getById(id); // throws if not found
    return facultyRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const faculty = await facultyService.getById(id);
    const deptCount = await departmentRepository.countByFaculty(id);
    if (deptCount > 0) {
      throw new ConflictError(
        `Cannot delete faculty — it has ${deptCount} department(s). Delete them first.`,
      );
    }
    return faculty.softDelete(userId);
  },
};

module.exports = facultyService;
