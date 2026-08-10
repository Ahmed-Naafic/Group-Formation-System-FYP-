const semesterRepository       = require('../repositories/semesterRepository');
const academicYearService      = require('../../academicYear/services/academicYearService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');
const {
  MAX_SEMESTERS_PER_YEAR,
  assertDuration,
  assertWithinAcademicYear,
  assertNoOverlap,
  nextSemesterName,
} = require('./semesterRules');

const semesterService = {
  // `name` is never taken from the request — it's always derived from what
  // already exists in the academic year (see semesterRules.nextSemesterName),
  // so it can't be spoofed, mistyped, or duplicated through the API.
  async create(data) {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestError('startDate must be before endDate');
    }
    const ay = await academicYearService.getById(data.academicYearId);
    assertWithinAcademicYear(data.startDate, data.endDate, ay);
    assertDuration(data.startDate, data.endDate);

    const siblings = await semesterRepository.findActiveByAcademicYear(data.academicYearId);
    assertNoOverlap(siblings, data.startDate, data.endDate, null);

    const name = nextSemesterName(siblings);
    if (!name) {
      throw new ConflictError(
        `This academic year already has the maximum of ${MAX_SEMESTERS_PER_YEAR} semesters.`,
      );
    }

    return semesterRepository.create({ ...data, name });
  },

  getAll(filter = {}) {
    return semesterRepository.findAll(filter);
  },

  async getById(id) {
    const semester = await semesterRepository.findById(id);
    if (!semester) throw new NotFoundError('Semester not found');
    return semester;
  },

  // `name` is immutable after creation — it's not accepted by the update
  // schema, so it's never present in `updates` here.
  async update(id, updates) {
    const semester = await semesterService.getById(id);

    const start = updates.startDate ? new Date(updates.startDate) : semester.startDate;
    const end   = updates.endDate   ? new Date(updates.endDate)   : semester.endDate;

    if (start >= end) throw new BadRequestError('startDate must be before endDate');

    const targetAYId = updates.academicYearId
      ?? String(semester.academicYearId?._id ?? semester.academicYearId);
    const ay = await academicYearService.getById(targetAYId);
    assertWithinAcademicYear(start, end, ay);
    assertDuration(start, end);

    const siblings = await semesterRepository.findActiveByAcademicYear(targetAYId);
    assertNoOverlap(siblings, start, end, id);

    // Moving to a different academic year that already has this semester's
    // number (e.g. this is "Semester 3" and the target year already has one)
    // is the only way a duplicate name can still occur, since names are
    // otherwise always derived fresh on create.
    if (updates.academicYearId) {
      const duplicate = siblings.find(
        (s) => String(s._id) !== id && s.name.toLowerCase() === semester.name.toLowerCase(),
      );
      if (duplicate) {
        throw new ConflictError(`A semester named "${semester.name}" already exists in this academic year.`);
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
