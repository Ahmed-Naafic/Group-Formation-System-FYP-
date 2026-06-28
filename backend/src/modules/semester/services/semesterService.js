const semesterRepository       = require('../repositories/semesterRepository');
const academicYearService      = require('../../academicYear/services/academicYearService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');

function _assertWithinAY(startDate, endDate, ay) {
  const semStart = new Date(startDate);
  const semEnd   = new Date(endDate);
  const ayStart  = new Date(ay.startDate);
  const ayEnd    = new Date(ay.endDate);
  if (semStart < ayStart || semEnd > ayEnd) {
    const fmt = d => d.toISOString().slice(0, 10);
    throw new BadRequestError(
      `Semester dates must fall within the academic year's date range (AY starts ${fmt(ayStart)}, ends ${fmt(ayEnd)}).`,
    );
  }
}

const semesterService = {
  async create(data) {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestError('startDate must be before endDate');
    }
    const ay = await academicYearService.getById(data.academicYearId);
    _assertWithinAY(data.startDate, data.endDate, ay);
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

    const start = updates.startDate ? new Date(updates.startDate) : semester.startDate;
    const end   = updates.endDate   ? new Date(updates.endDate)   : semester.endDate;

    if (start >= end) throw new BadRequestError('startDate must be before endDate');

    const targetAYId = updates.academicYearId
      ?? String(semester.academicYearId?._id ?? semester.academicYearId);
    const ay = await academicYearService.getById(targetAYId);
    _assertWithinAY(start, end, ay);

    if (updates.name || updates.academicYearId) {
      const targetName = updates.name ?? semester.name;
      const duplicate  = await semesterRepository.findActiveByNameAndAcademicYear(targetName, targetAYId);
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
