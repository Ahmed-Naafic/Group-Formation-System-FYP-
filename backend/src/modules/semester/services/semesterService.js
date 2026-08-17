const semesterRepository       = require('../repositories/semesterRepository');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, ConflictError } = require('../../../common/errors');
const { buildDefaultSemesters } = require('./semesterRules');

const semesterService = {
  // Semesters are entirely system-managed — there is no admin-facing create/
  // update/delete. This is the only way semester documents ever come into
  // existence, called once by academicYearService right after an academic
  // year is created. Always exactly the 10 default semesters, in one insert.
  createDefaultSemesters(academicYearId, createdBy) {
    const docs = buildDefaultSemesters(academicYearId, createdBy);
    return semesterRepository.insertMany(docs);
  },

  getAll(filter = {}) {
    return semesterRepository.findAll(filter);
  },

  async getById(id) {
    const semester = await semesterRepository.findById(id);
    if (!semester) throw new NotFoundError('Semester not found');
    return semester;
  },

  getByAcademicYear(academicYearId) {
    return semesterRepository.findByAcademicYear(academicYearId);
  },

  // Used by academicYearService's delete guard — "has historical data" now
  // means "has course offerings under any of its 10 semesters", not merely
  // "has semesters" (every academic year always does, by design).
  async countCourseOfferings(academicYearId) {
    const semesters = await semesterRepository.findByAcademicYear(academicYearId);
    if (semesters.length === 0) return 0;
    return courseOfferingRepository.countBySemesterIds(semesters.map((s) => s._id));
  },

  // Cross-validation used by courseOfferingService — the selected semester
  // must actually belong to the selected/implied academic year. Throws the
  // exact error the spec calls for rather than a generic mismatch message.
  async assertBelongsToAcademicYear(semesterId, academicYearId) {
    const semester = await semesterService.getById(semesterId);
    if (String(semester.academicYearId?._id ?? semester.academicYearId) !== String(academicYearId)) {
      throw new ConflictError('The selected semester does not belong to the selected academic year.');
    }
    return semester;
  },
};

module.exports = semesterService;
