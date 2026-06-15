const courseRepository         = require('../repositories/courseRepository');
const departmentService        = require('../../department/services/departmentService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, ConflictError } = require('../../../common/errors');

const courseService = {
  async create(data) {
    await departmentService.getById(data.departmentId);

    const [dupCode, dupName] = await Promise.all([
      courseRepository.findOne({ departmentId: data.departmentId, code: data.code.toUpperCase() }),
      courseRepository.findActiveByNameAndDepartment(data.name, data.departmentId),
    ]);
    if (dupCode) throw new ConflictError('A course with this code already exists in this department.');
    if (dupName) throw new ConflictError(`A course named "${data.name}" already exists in this department.`);

    return courseRepository.create(data);
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

    if (updates.code) {
      const dupCode = await courseRepository.findOne({
        departmentId: targetDeptId,
        code: updates.code.toUpperCase(),
      });
      if (dupCode && dupCode._id.toString() !== id) {
        throw new ConflictError('A course with this code already exists in this department.');
      }
    }

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
