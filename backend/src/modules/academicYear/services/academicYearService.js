const academicYearRepository = require('../repositories/academicYearRepository');
const semesterRepository     = require('../../semester/repositories/semesterRepository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');

const academicYearService = {
  getAll() {
    return academicYearRepository.findAll();
  },

  async getById(id) {
    const ay = await academicYearRepository.findById(id);
    if (!ay) throw new NotFoundError('Academic year not found');
    return ay;
  },

  async create(data) {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestError('startDate must be before endDate');
    }
    const duplicate = await academicYearRepository.findActiveByName(data.name);
    if (duplicate) throw new ConflictError(`An academic year named "${data.name}" already exists.`);
    return academicYearRepository.create(data);
  },

  async update(id, updates) {
    const ay = await academicYearService.getById(id);
    if (updates.startDate || updates.endDate) {
      const start = updates.startDate ? new Date(updates.startDate) : ay.startDate;
      const end   = updates.endDate   ? new Date(updates.endDate)   : ay.endDate;
      if (start >= end) throw new BadRequestError('startDate must be before endDate');
    }
    if (updates.name) {
      const duplicate = await academicYearRepository.findActiveByName(updates.name);
      if (duplicate && String(duplicate._id) !== id) {
        throw new ConflictError(`An academic year named "${updates.name}" already exists.`);
      }
    }
    return academicYearRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const ay = await academicYearService.getById(id);
    const semesterCount = await semesterRepository.countByAcademicYear(id);
    if (semesterCount > 0) {
      throw new ConflictError(
        `Cannot delete academic year — it has ${semesterCount} semester(s). Delete them first.`,
      );
    }
    return ay.softDelete(userId);
  },
};

module.exports = academicYearService;
