const courseRepository  = require('../repositories/courseRepository');
const departmentService = require('../../department/services/departmentService');
const classRepository   = require('../../class/repositories/classRepository');
const { NotFoundError, ConflictError } = require('../../../common/errors');

const courseService = {
  async create(data) {
    await departmentService.getById(data.departmentId);

    const duplicate = await courseRepository.findOne({
      departmentId: data.departmentId,
      code: data.code.toUpperCase(),
    });
    if (duplicate) throw new ConflictError('Course code already exists in this department');

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

    if (updates.code) {
      const targetDeptId = updates.departmentId || course.departmentId;
      const duplicate = await courseRepository.findOne({
        departmentId: targetDeptId,
        code: updates.code.toUpperCase(),
      });
      // Allow if the duplicate is the same doc being updated
      if (duplicate && duplicate._id.toString() !== id) {
        throw new ConflictError('Course code already exists in this department');
      }
    }

    return courseRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const course = await courseService.getById(id);
    const classCount = await classRepository.countByCourse(id);
    if (classCount > 0) {
      throw new ConflictError(
        `Cannot delete course — ${classCount} class(es) are using it. Remove it from those classes first.`,
      );
    }
    return course.softDelete(userId);
  },
};

module.exports = courseService;
