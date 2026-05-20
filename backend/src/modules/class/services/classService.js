const classRepository = require('../repositories/classRepository');
const courseService = require('../../course/services/courseService');
const semesterService = require('../../semester/services/semesterService');
const userService = require('../../user/services/userService');
const { NotFoundError, BadRequestError } = require('../../../common/errors');

async function validateInstructor(instructorId) {
  const instructor = await userService.findById(instructorId);
  if (!instructor) throw new NotFoundError('Instructor not found');
  if (instructor.role !== 'instructor') {
    throw new BadRequestError('The specified user is not an instructor');
  }
}

const classService = {
  async create(data) {
    await courseService.getById(data.courseId);
    await semesterService.getById(data.semesterId);
    if (data.instructorId) await validateInstructor(data.instructorId);

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
    if (updates.courseId) await courseService.getById(updates.courseId);
    if (updates.semesterId) await semesterService.getById(updates.semesterId);
    if (updates.instructorId) await validateInstructor(updates.instructorId);

    return classRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const cls = await classService.getById(id);
    return cls.softDelete(userId);
  },
};

module.exports = classService;
