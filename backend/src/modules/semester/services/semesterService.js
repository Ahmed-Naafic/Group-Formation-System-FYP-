const semesterRepository = require('../repositories/semesterRepository');
const classRepository    = require('../../class/repositories/classRepository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');

const semesterService = {
  async create(data) {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestError('startDate must be before endDate');
    }
    return semesterRepository.create(data);
  },

  getAll(filter = {}) {
    return semesterRepository.findAll(filter);
  },

  async getById(id) {
    const semester = await semesterRepository.findById(id);
    if (!semester) throw new NotFoundError('Semester not found');
    return semester;
  },

  async update(id, updates) {
    const semester = await semesterService.getById(id);

    const start = updates.startDate ? new Date(updates.startDate) : semester.startDate;
    const end = updates.endDate ? new Date(updates.endDate) : semester.endDate;
    if (start >= end) throw new BadRequestError('startDate must be before endDate');

    return semesterRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const semester = await semesterService.getById(id);
    const classCount = await classRepository.countBySemester(id);
    if (classCount > 0) {
      throw new ConflictError(
        `Cannot delete semester — it has ${classCount} class(es). Delete them first.`,
      );
    }
    return semester.softDelete(userId);
  },
};

module.exports = semesterService;
