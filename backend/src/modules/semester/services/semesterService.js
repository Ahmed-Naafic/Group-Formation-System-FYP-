const semesterRepository       = require('../repositories/semesterRepository');
const academicYearService      = require('../../academicYear/services/academicYearService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');

const semesterService = {
  async create(data) {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestError('startDate must be before endDate');
    }
    await academicYearService.getById(data.academicYearId);
    const duplicate = await semesterRepository.findActiveByNameAndAcademicYear(
      data.name, data.academicYearId,
    );
    if (duplicate) {
      throw new ConflictError(`A semester named "${data.name}" already exists in this academic year.`);
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

    if (updates.startDate || updates.endDate) {
      const start = updates.startDate ? new Date(updates.startDate) : semester.startDate;
      const end   = updates.endDate   ? new Date(updates.endDate)   : semester.endDate;
      if (start >= end) throw new BadRequestError('startDate must be before endDate');
    }

    if (updates.academicYearId) {
      await academicYearService.getById(updates.academicYearId);
    }

    if (updates.name || updates.academicYearId) {
      const targetName = updates.name           ?? semester.name;
      const targetYear = updates.academicYearId ?? String(semester.academicYearId?._id ?? semester.academicYearId);
      const duplicate  = await semesterRepository.findActiveByNameAndAcademicYear(targetName, targetYear);
      if (duplicate && String(duplicate._id) !== id) {
        throw new ConflictError(`A semester named "${targetName}" already exists in this academic year.`);
      }
    }

    return semesterRepository.updateById(id, updates);
  },

  async softDelete(id, userId) {
    const semester     = await semesterService.getById(id);
    const offeringCount = await courseOfferingRepository.countBySemester(id);
    if (offeringCount > 0) {
      throw new ConflictError(
        `Cannot delete semester — it has ${offeringCount} course offering(s). Remove them first.`,
      );
    }
    return semester.softDelete(userId);
  },
};

module.exports = semesterService;
