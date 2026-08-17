const academicYearRepository = require('../repositories/academicYearRepository');
const semesterRepository     = require('../../semester/repositories/semesterRepository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../../common/errors');
const {
  deriveName,
  assertDuration,
  assertEarliestYear,
  assertNoOverlap,
  assertSequentialNext,
  assertCreationWindow,
} = require('./academicYearRules');

const academicYearService = {
  getAll() {
    return academicYearRepository.findAll();
  },

  async getById(id) {
    const ay = await academicYearRepository.findById(id);
    if (!ay) throw new NotFoundError('Academic year not found');
    return ay;
  },

  // `data` is expected to contain only startDate/endDate — the Joi schema
  // strips name/status if a caller sends them directly, so they never reach
  // here. `now` defaults to the real current date; tests can pass a fixed
  // value to make the one-month creation window deterministic.
  async create(data, now = new Date()) {
    const start = new Date(data.startDate);
    const end   = new Date(data.endDate);
    if (start >= end) {
      throw new BadRequestError('startDate must be before endDate');
    }

    assertEarliestYear(start);
    assertDuration(start, end);

    const latest = await academicYearRepository.findLatest();
    assertSequentialNext(start, latest);
    assertCreationWindow(latest, now);

    const existing = await academicYearRepository.findAll();
    assertNoOverlap(existing, start, end, null);

    const name = deriveName(start);
    const duplicate = await academicYearRepository.findActiveByName(name);
    if (duplicate) throw new ConflictError(`An academic year named "${name}" already exists.`);

    return academicYearRepository.create({
      startDate: start,
      endDate:   end,
      name,
      createdBy: data.createdBy,
    });
  },

  // Only startDate/endDate are ever accepted (see validation schema) — name
  // is always re-derived from the resulting startDate, never taken from the
  // client. Sequential-next and the one-month creation window are create-time
  // gates only; they don't re-apply here.
  async update(id, updates) {
    const ay = await academicYearService.getById(id);

    // The update schema only accepts startDate/endDate (min 1 required), so
    // at least one of them is always present here.
    const semesterCount = await semesterRepository.countByAcademicYear(id);
    if (semesterCount > 0) {
      throw new ConflictError(
        `Cannot change the dates of this academic year — it has ${semesterCount} semester(s) `
        + `that depend on its current range. Remove them first.`,
      );
    }

    const start = updates.startDate ? new Date(updates.startDate) : new Date(ay.startDate);
    const end   = updates.endDate   ? new Date(updates.endDate)   : new Date(ay.endDate);
    if (start >= end) {
      throw new BadRequestError('startDate must be before endDate');
    }

    assertEarliestYear(start);
    assertDuration(start, end);

    const existing = await academicYearRepository.findAll();
    assertNoOverlap(existing, start, end, id);

    const name = deriveName(start);
    if (name !== ay.name) {
      const duplicate = await academicYearRepository.findActiveByName(name);
      if (duplicate && String(duplicate._id) !== id) {
        throw new ConflictError(`An academic year named "${name}" already exists.`);
      }
    }

    return academicYearRepository.updateById(id, { startDate: start, endDate: end, name });
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
