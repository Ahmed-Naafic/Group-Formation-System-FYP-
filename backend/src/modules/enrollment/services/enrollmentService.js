const columnMapper    = require('../utils/columnMapper');
const cohortService   = require('../../cohort/services/cohortService');
const userService     = require('../../user/services/userService');
const studentService  = require('../../student/services/studentService');
const performanceService = require('../../performance/services/performanceService');
const passwordGenerator = require('../../../common/utils/passwordGenerator');
const instructorAssignmentService = require('../../instructorAssignment/services/instructorAssignmentService');
const { ForbiddenError, BadRequestError, TransferConfirmationError } = require('../../../common/errors');

// averageScore is 0–100; blank/invalid → null (UNGRADED)
function parseAverageScore(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
}

// Admin: unrestricted. Instructor: must have at least one active offering for this cohort.
async function assertCohortAccess(cohortId, context) {
  const cohort = await cohortService.getById(cohortId);
  if (context.role === 'admin') return cohort;
  const hasAccess = await instructorAssignmentService.hasActiveOfferingInCohort(context.userId, cohortId);
  if (!hasAccess) {
    throw new ForbiddenError('You do not have access to this cohort');
  }
  return cohort;
}

const enrollmentService = {
  async bulkUpload(cohortId, buffer, mimetype, originalname, confirmTransfers, context) {
    const targetCohort = await assertCohortAccess(cohortId, context);

    let rawRows;
    try {
      rawRows = await columnMapper.parse(buffer, mimetype, originalname);
    } catch (err) {
      throw new BadRequestError(`Could not parse file: ${err.message}`);
    }

    // ── First pass: detect any cross-cohort transfers ──────────────────────
    const wouldTransfer = [];

    for (const row of rawRows) {
      const studentId = row.studentId != null ? String(row.studentId).trim() : '';
      const fullName  = row.fullName  != null ? String(row.fullName).trim()  : '';
      if (!studentId) continue;

      try {
        const isDuplicate = await studentService.existsByStudentIdAndCohort(studentId, cohortId);
        if (isDuplicate) continue;

        const user = await userService.findByStudentId(studentId);
        if (!user) continue;

        const existing = await studentService.findActiveInOtherCohort(user._id, cohortId);
        if (existing) {
          const fromCohort = await cohortService.getById(String(existing.cohortId));
          wouldTransfer.push({
            studentId,
            fullName: fullName || existing.fullName,
            fromCohortName: fromCohort.name,
            toCohortName: targetCohort.name,
          });
        }
      } catch {
        // If transfer status is indeterminate for a row, defer to second pass.
      }
    }

    if (wouldTransfer.length > 0 && !confirmTransfers) {
      throw new TransferConfirmationError(wouldTransfer);
    }

    // ── Second pass: process rows ──────────────────────────────────────────
    const { thresholds } = await performanceService.getSettings();

    const created     = [];
    const skipped     = [];
    const transferred = [];
    const failed      = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // row 1 = header
      const row = rawRows[i];

      try {
        const studentId = row.studentId != null ? String(row.studentId).trim() : '';
        const fullName  = row.fullName  != null ? String(row.fullName).trim()  : '';

        if (!studentId || !fullName) {
          const missing = [];
          if (!studentId) missing.push('studentId');
          if (!fullName)  missing.push('fullName');
          failed.push({ row: rowNum, reason: `Missing required fields: ${missing.join(', ')}` });
          continue;
        }

        const isDuplicate = await studentService.existsByStudentIdAndCohort(studentId, cohortId);
        if (isDuplicate) {
          skipped.push({ studentId, fullName, reason: 'already exists in this cohort' });
          continue;
        }

        const averageScore        = parseAverageScore(row.averageScore);
        const performanceCategory = performanceService.mapToCategory(averageScore, thresholds);

        let user = await userService.findByStudentId(studentId);
        let tempPassword = null;

        if (!user) {
          tempPassword = passwordGenerator.generate();
          user = await userService.createUser({
            studentId,
            fullName,
            role: 'student',
            password: tempPassword,
            mustChangePassword: true,
          });
        }

        const existing = await studentService.findActiveInOtherCohort(user._id, cohortId);

        if (existing) {
          const fromCohort = await cohortService.getById(String(existing.cohortId));
          await studentService.archiveRecord(existing, context.userId);
          await studentService.createRecord({
            userId: user._id,
            cohortId,
            fullName,
            averageScore,
            performanceCategory,
          });
          transferred.push({
            studentId,
            fullName,
            fromCohortId:   String(existing.cohortId),
            fromCohortName: fromCohort.name,
          });
        } else {
          await studentService.createRecord({
            userId: user._id,
            cohortId,
            fullName,
            averageScore,
            performanceCategory,
          });
          created.push({ studentId, fullName, tempPassword });
        }
      } catch (err) {
        failed.push({ row: rowNum, reason: err.message });
      }
    }

    return { created, skipped, transferred, failed };
  },
};

module.exports = enrollmentService;
