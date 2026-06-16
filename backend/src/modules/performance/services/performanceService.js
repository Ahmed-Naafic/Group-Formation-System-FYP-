const performanceSettingsRepository = require('../repositories/performanceSettingsRepository');
const studentRepository      = require('../../student/repositories/studentRepository');
const cohortService          = require('../../cohort/services/cohortService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

// Admin: unrestricted. Instructor: must have at least one active offering for this cohort.
async function assertCohortAccess(cohortId, context) {
  const cohort = await cohortService.getById(cohortId);
  if (context.role === 'admin') return cohort;
  const offerings = await courseOfferingRepository.findAll({
    cohortId,
    instructorId: context.userId,
    status: 'active',
  });
  if (!offerings || offerings.length === 0) {
    throw new ForbiddenError('You do not have access to this cohort');
  }
  return cohort;
}

// Pure mapping — no DB calls. Exported so other services (enrollment) can use it.
function mapToCategory(averageScore, thresholds) {
  if (averageScore === null || averageScore === undefined) return null;
  if (averageScore >= thresholds.high)   return 'HIGH';
  if (averageScore >= thresholds.medium) return 'MEDIUM';
  return 'LOW';
}

const performanceService = {
  mapToCategory,

  getSettings() {
    return performanceSettingsRepository.getSettings();
  },

  async updateSettings(data, userId) {
    const settings = await performanceSettingsRepository.updateSettings({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    });

    const students = await studentRepository.findAll({});
    await Promise.all(
      students.map((s) =>
        studentRepository.updateById(s._id, {
          performanceCategory: mapToCategory(s.averageScore, settings.thresholds),
        })
      )
    );

    return { settings, recalculated: students.length };
  },

  // Called internally after averageScore changes — no ownership check.
  async recalculate(studentRecordId) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) return null;
    const { thresholds } = await performanceSettingsRepository.getSettings();
    const performanceCategory = mapToCategory(student.averageScore, thresholds);
    return studentRepository.updateById(student._id, { performanceCategory });
  },

  // Called from routes — verifies cohort ownership before recomputing one student.
  async calculateForStudent(studentRecordId, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertCohortAccess(student.cohortId, context);
    const { thresholds } = await performanceSettingsRepository.getSettings();
    const performanceCategory = mapToCategory(student.averageScore, thresholds);
    return studentRepository.updateById(student._id, { performanceCategory });
  },

  // Updates Student.averageScore and auto-recalculates performanceCategory.
  async updateStudentScores(studentRecordId, averageScore, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertCohortAccess(student.cohortId, context);
    await studentRepository.updateById(studentRecordId, { averageScore });
    return performanceService.recalculate(studentRecordId);
  },

  // Batch-recomputes all students in a cohort.
  async calculateForCohort(cohortId, context) {
    await assertCohortAccess(cohortId, context);
    const students = await studentRepository.findAll({ cohortId, deletedAt: null });
    const { thresholds } = await performanceSettingsRepository.getSettings();
    await Promise.all(
      students.map((s) =>
        studentRepository.updateById(s._id, {
          performanceCategory: mapToCategory(s.averageScore, thresholds),
        })
      )
    );
    return { cohortId, updated: students.length };
  },
};

module.exports = performanceService;
