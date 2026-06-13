const classRepository   = require('../repositories/classRepository');
const courseService     = require('../../course/services/courseService');
const semesterService   = require('../../semester/services/semesterService');
const studentRepository = require('../../student/repositories/studentRepository');
const groupRepository   = require('../../group/repositories/groupRepository');
const { NotFoundError, ConflictError } = require('../../../common/errors');

const classService = {
  async create(data) {
    for (const cid of data.courseIds ?? []) await courseService.getById(cid);
    await semesterService.getById(data.semesterId);
    return classRepository.create(data);
  },

  getAll(filter = {}) {
    return classRepository.findAll(filter);
  },

  async getById(id) {
    const cls = await classRepository.findById(id);
    if (!cls) throw new NotFoundError('Class not found');
    return cls;
  },

  async update(id, updates) {
    await classService.getById(id);
    if (updates.courseIds) {
      for (const cid of updates.courseIds) await courseService.getById(cid);
    }
    if (updates.semesterId) await semesterService.getById(updates.semesterId);
    return classRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const cls = await classService.getById(id);
    const [studentCount, groupCount] = await Promise.all([
      studentRepository.countByClass(id),
      groupRepository.countActiveByClass(id),
    ]);
    const parts = [];
    if (studentCount > 0) parts.push(`${studentCount} student(s)`);
    if (groupCount > 0)   parts.push(`${groupCount} active group(s)`);
    if (parts.length > 0) {
      throw new ConflictError(
        `Cannot delete class — it has ${parts.join(' and ')}. Remove them first.`,
      );
    }
    return cls.softDelete(userId);
  },
};

module.exports = classService;
