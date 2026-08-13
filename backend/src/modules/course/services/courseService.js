const courseRepository         = require('../repositories/courseRepository');
const departmentService        = require('../../department/services/departmentService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { generateCourseCode }   = require('../utils/courseCodeGenerator');
const { NotFoundError, ConflictError } = require('../../../common/errors');

const courseService = {
  async create(data) {
    const department = await departmentService.getById(data.departmentId);

    const dupName = await courseRepository.findActiveByNameAndDepartment(data.name, data.departmentId);
    if (dupName) throw new ConflictError(`A course named "${data.name}" already exists in this department.`);

    const code = await generateCourseCode(data.departmentId, department.name);

    return courseRepository.create({ ...data, code });
  },

  getAll(filter = {}) {
    return courseRepository.findAll(filter);
  },

  async getById(id) {
    const course = await courseRepository.findById(id);
    if (!course) throw new NotFoundError('Course not found');
    return course;
  },

  async update(id, updates) {
    const course = await courseService.getById(id);

    if (updates.departmentId) {
      await departmentService.getById(updates.departmentId);
    }

    const targetDeptId = updates.departmentId || course.departmentId;

    if (updates.name) {
      const dupName = await courseRepository.findActiveByNameAndDepartment(updates.name, targetDeptId);
      if (dupName && dupName._id.toString() !== id) {
        throw new ConflictError(`A course named "${updates.name}" already exists in this department.`);
      }
    }

    return courseRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const course        = await courseService.getById(id);
    const offeringCount = await courseOfferingRepository.countByCourse(id);
    if (offeringCount > 0) {
      throw new ConflictError(
        `Cannot delete course — it has ${offeringCount} active course offering(s). Remove them first.`,
      );
    }
    return course.softDelete(userId);
  },
};

module.exports = courseService;
