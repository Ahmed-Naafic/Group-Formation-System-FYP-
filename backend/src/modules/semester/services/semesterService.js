const semesterRepository       = require('../repositories/semesterRepository');
const classRepository          = require('../../class/repositories/classRepository');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');

const semesterService = {
  async create(data) {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestError('startDate must be before endDate');
    }
    const duplicate = await semesterRepository.findActiveByNameAndYear(data.name, data.year);
    if (duplicate) {
      throw new ConflictError(`A semester named "${data.name}" already exists in ${data.year}.`);
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
    const end   = updates.endDate   ? new Date(updates.endDate)   : semester.endDate;
    if (start >= end) throw new BadRequestError('startDate must be before endDate');

    if (updates.name || updates.year) {
      const targetName = updates.name ?? semester.name;
      const targetYear = updates.year ?? semester.year;
      const duplicate  = await semesterRepository.findActiveByNameAndYear(targetName, targetYear);
      if (duplicate && String(duplicate._id) !== id) {
        throw new ConflictError(`A semester named "${targetName}" already exists in ${targetYear}.`);
      }
    }

    return semesterRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const semester = await semesterService.getById(id);
    const [classCount, offeringCount] = await Promise.all([
      classRepository.countBySemester(id),
      courseOfferingRepository.countBySemester(id),
    ]);
    const parts = [];
    if (classCount > 0)    parts.push(`${classCount} class(es)`);
    if (offeringCount > 0) parts.push(`${offeringCount} course offering(s)`);
    if (parts.length > 0) {
      throw new ConflictError(
        `Cannot delete semester — it has ${parts.join(' and ')}. Delete them first.`,
      );
    }
    return semester.softDelete(userId);
  },
};

module.exports = semesterService;
