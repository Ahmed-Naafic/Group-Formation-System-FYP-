const performanceSettingsRepository = require('../repositories/performanceSettingsRepository');
const studentRepository = require('../../student/repositories/studentRepository');
const classService = require('../../class/services/classService');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

async function assertClassAccess(classId, context) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const assignedId = cls.instructorId?._id?.toString() ?? cls.instructorId?.toString();
  if (!assignedId || assignedId !== context.userId.toString()) {
    throw new ForbiddenError('You do not have access to this class');
  }
  return cls;
}

// Core math — accepts a pre-fetched student and settings to avoid redundant DB calls.
//
// Missing score handling: Option B — re-normalize over present components.
// Null scores are excluded entirely (not treated as 0), so a student graded on
// only the midterm mid-semester is scored purely on that component. When all
// scores are present the result is identical to a straight weighted average.
async function _compute(student, settings) {
  const { scores } = student;
  const { maxMarks, weights, thresholds } = settings;

  // All null → not yet graded; leave totalScore and category null
  if (scores.midterm === null && scores.final === null && scores.coursework === null) {
    return studentRepository.updateById(student._id, {
      totalScore: null,
      performanceCategory: null,
    });
  }

  // Build the list of components that have an actual score
  const present = [
    { score: scores.midterm,    max: maxMarks.midterm,    weight: weights.midterm },
    { score: scores.final,      max: maxMarks.final,      weight: weights.final },
    { score: scores.coursework, max: maxMarks.coursework, weight: weights.coursework },
  ].filter((c) => c.score !== null);

  const presentWeightSum = present.reduce((sum, c) => sum + c.weight, 0);

  // Guard: should never be 0 when at least one score is non-null, but be safe
  if (presentWeightSum === 0) {
    return studentRepository.updateById(student._id, {
      totalScore: null,
      performanceCategory: null,
    });
  }

  // Cap each component at 100% — stale scores from a maxMarks reduction can't push total above 100
  const weightedSum = present.reduce((sum, c) => sum + Math.min(100, (c.score / c.max) * 100) * c.weight, 0);
  const totalScore = parseFloat((weightedSum / presentWeightSum).toFixed(2));

  const performanceCategory =
    totalScore >= thresholds.high   ? 'HIGH'   :
    totalScore >= thresholds.medium ? 'MEDIUM' : 'LOW';

  return studentRepository.updateById(student._id, { totalScore, performanceCategory });
}

const performanceService = {
  getSettings() {
    return performanceSettingsRepository.getSettings();
  },

  async updateSettings(data, userId) {
    // Warn if any stored scores exceed the incoming maxMarks — don't modify data, just count
    const affectedCount = await studentRepository.countExceedingScores(data.maxMarks);
    const settings = await performanceSettingsRepository.updateSettings({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    });
    return { settings, affectedCount };
  },

  // Called internally (e.g. from attendanceService after a score update).
  // Auth is already verified by the caller — no ownership check here.
  async recalculate(studentRecordId) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) return null;
    const settings = await performanceSettingsRepository.getSettings();
    return _compute(student, settings);
  },

  // Called from routes — verifies class ownership before computing.
  async calculateForStudent(studentRecordId, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);
    const settings = await performanceSettingsRepository.getSettings();
    return _compute(student, settings);
  },

  // Batch-recalculates all students in a class.
  // Fetches settings once and reuses across all students for efficiency.
  async calculateForClass(classId, context) {
    await assertClassAccess(classId, context);
    const students = await studentRepository.findAll({ classId });
    const settings = await performanceSettingsRepository.getSettings();
    await Promise.all(students.map((s) => _compute(s, settings)));
    return { classId, updated: students.length };
  },
};

module.exports = performanceService;
