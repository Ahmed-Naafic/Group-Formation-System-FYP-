const performanceSettingsRepository = require('../repositories/performanceSettingsRepository');
const studentRepository = require('../../student/repositories/studentRepository');
const classService = require('../../class/services/classService');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

async function assertClassAccess(classId, context) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const allowed = await courseAssignmentService.hasAccess(context.userId, String(classId));
  if (!allowed) throw new ForbiddenError('You do not have access to this class');
  return cls;
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

    // Auto-recalculate every student so categories are never stale after a threshold change.
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

  // Called from routes — verifies class ownership before recomputing.
  async calculateForStudent(studentRecordId, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);
    const { thresholds } = await performanceSettingsRepository.getSettings();
    const performanceCategory = mapToCategory(student.averageScore, thresholds);
    return studentRepository.updateById(student._id, { performanceCategory });
  },

  // Updates Student.attendance field (moved from old attendanceService).
  async updateStudentAttendance(studentRecordId, attendance, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);
    return studentRepository.updateById(studentRecordId, { attendance });
  },

  // Updates Student.averageScore and auto-recalculates performanceCategory.
  async updateStudentScores(studentRecordId, averageScore, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);
    await studentRepository.updateById(studentRecordId, { averageScore });
    return performanceService.recalculate(studentRecordId);
  },

  // Batch-recomputes all students in a class.
  async calculateForClass(classId, context) {
    await assertClassAccess(classId, context);
    const students = await studentRepository.findAll({ classId });
    const { thresholds } = await performanceSettingsRepository.getSettings();
    await Promise.all(
      students.map((s) =>
        studentRepository.updateById(s._id, {
          performanceCategory: mapToCategory(s.averageScore, thresholds),
        })
      )
    );
    return { classId, updated: students.length };
  },
};

module.exports = performanceService;
