const columnMapper    = require('../utils/columnMapper');
const describeRowError = require('../utils/describeRowError');
const mapWithConcurrency = require('../utils/mapWithConcurrency');
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

// How many rows' worth of DB work runs concurrently in each phase of
// bulkUpload. Rows are independent (within-file duplicate studentIds are
// rejected before this point, so no two in-flight rows ever touch the same
// User/Student), so bounding this to a modest pool overlaps network latency
// across rows instead of paying it once per row, serially.
const BULK_UPLOAD_CONCURRENCY = 8;

const enrollmentService = {
  async bulkUpload(cohortId, buffer, mimetype, originalname, confirmTransfers, context) {
    const targetCohort = await assertCohortAccess(cohortId, context);

    let rawRows;
    try {
      rawRows = await columnMapper.parse(buffer, mimetype, originalname);
    } catch (err) {
      throw new BadRequestError(`Could not parse file: ${err.message}`);
    }

    const { thresholds } = await performanceService.getSettings();

    // ── Pass 1a: sync pre-scan — validity + within-file duplicates ─────────
    // Must stay single-threaded and in row order: "first seen on row X" is
    // only meaningful relative to rows already scanned.
    const seenInFile = new Map(); // studentId -> first row it appeared on
    const resolved = new Array(rawRows.length);
    const pendingIndexes = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // row 1 = header
      const row = rawRows[i];
      const studentId = row.studentId != null ? String(row.studentId).trim() : '';
      const fullName  = row.fullName  != null ? String(row.fullName).trim()  : '';

      if (!studentId || !fullName) {
        const missing = [];
        if (!studentId) missing.push('studentId');
        if (!fullName)  missing.push('fullName');
        resolved[i] = { kind: 'failed', rowNum, studentId: studentId || null, reason: `Missing required field(s): ${missing.join(', ')}.` };
        continue;
      }

      const firstSeenRow = seenInFile.get(studentId);
      if (firstSeenRow) {
        resolved[i] = {
          kind: 'failed', rowNum, studentId,
          reason: `Duplicate Student ID "${studentId}" inside the uploaded file — first seen on row ${firstSeenRow}.`,
        };
        continue;
      }
      seenInFile.set(studentId, rowNum);
      pendingIndexes.push(i);
    }

    // ── Pass 1b: resolve each row's plan, read-only, several in flight ─────
    // Each row's user is looked up exactly once (not once per check, not
    // once per row per pass) — for an N-row file this, combined with running
    // several rows concurrently, is what keeps a large file from taking long
    // enough to trip a client/proxy timeout even though the rows were still
    // being written successfully underneath it.
    await mapWithConcurrency(pendingIndexes, BULK_UPLOAD_CONCURRENCY, async (i) => {
      const rowNum = i + 2;
      const row = rawRows[i];
      const studentId = String(row.studentId).trim();
      const fullName  = String(row.fullName).trim();

      try {
        const averageScore        = parseAverageScore(row.averageScore);
        const performanceCategory = performanceService.mapToCategory(averageScore, thresholds);

        // Includes soft-deleted accounts — a single lookup tells us whether
        // the studentId is unused, active, or sitting in trash.
        const user = await userService.findByStudentIdIncludingDeleted(studentId);

        if (!user) {
          resolved[i] = { kind: 'create', rowNum, studentId, fullName, averageScore, performanceCategory, userId: null };
          return;
        }

        if (user.deletedAt) {
          resolved[i] = {
            kind: 'skipped', rowNum, studentId, fullName,
            reason: `Student ID "${studentId}" already exists in Trash. Restore the existing student ` +
              'instead of creating a duplicate.',
          };
          return;
        }

        const isDuplicate = await studentService.existsActiveByUserAndCohort(user._id, cohortId);
        if (isDuplicate) {
          resolved[i] = { kind: 'skipped', rowNum, studentId, fullName, reason: `Student ID "${studentId}" already exists in this cohort.` };
          return;
        }

        const existingElsewhere = await studentService.findActiveInOtherCohort(user._id, cohortId);
        if (existingElsewhere) {
          const fromCohort = await cohortService.getById(String(existingElsewhere.cohortId));
          resolved[i] = {
            kind: 'transfer', rowNum, studentId, fullName, averageScore, performanceCategory,
            userId: user._id, existingRecord: existingElsewhere,
            fromCohortId: String(existingElsewhere.cohortId), fromCohortName: fromCohort.name,
          };
          return;
        }

        const trashedHere = await studentService.findTrashedInCohort(user._id, cohortId);
        if (trashedHere) {
          resolved[i] = {
            kind: 'skipped', rowNum, studentId, fullName,
            reason: `Student ID "${studentId}" already exists in Trash for this cohort. Restore the ` +
              'existing student instead of creating a duplicate.',
          };
          return;
        }

        resolved[i] = { kind: 'create', rowNum, studentId, fullName, averageScore, performanceCategory, userId: user._id };
      } catch (err) {
        resolved[i] = { kind: 'failed', rowNum, studentId, reason: describeRowError(err) };
      }
    });

    // ── Transfer confirmation gate — before any writes happen ──────────────
    const wouldTransfer = resolved
      .filter((p) => p.kind === 'transfer')
      .map((p) => ({
        studentId: p.studentId, fullName: p.fullName,
        fromCohortName: p.fromCohortName, toCohortName: targetCohort.name,
      }));
    if (wouldTransfer.length > 0 && !confirmTransfers) {
      throw new TransferConfirmationError(wouldTransfer);
    }

    // ── Pass 2: write, using only what pass 1 already resolved ─────────────
    const created     = [];
    const skipped     = [];
    const transferred = [];
    const failed      = [];
    const writeResults = new Array(resolved.length);

    await mapWithConcurrency(resolved, BULK_UPLOAD_CONCURRENCY, async (plan, i) => {
      if (plan.kind === 'failed') {
        writeResults[i] = { bucket: 'failed', entry: { row: plan.rowNum, studentId: plan.studentId, reason: plan.reason } };
        return;
      }
      if (plan.kind === 'skipped') {
        writeResults[i] = { bucket: 'skipped', entry: { row: plan.rowNum, studentId: plan.studentId, fullName: plan.fullName, reason: plan.reason } };
        return;
      }

      try {
        if (plan.kind === 'transfer') {
          await studentService.archiveRecord(plan.existingRecord, context.userId);
          await studentService.createRecord({
            userId: plan.userId, cohortId, fullName: plan.fullName,
            averageScore: plan.averageScore, performanceCategory: plan.performanceCategory,
          });
          writeResults[i] = {
            bucket: 'transferred',
            entry: {
              row: plan.rowNum, studentId: plan.studentId, fullName: plan.fullName,
              fromCohortId: plan.fromCohortId, fromCohortName: plan.fromCohortName,
            },
          };
          return;
        }

        // plan.kind === 'create'
        let userId = plan.userId;
        let tempPassword = null;
        if (!userId) {
          tempPassword = passwordGenerator.generate();
          const user = await userService.createUser({
            studentId: plan.studentId, fullName: plan.fullName,
            role: 'student', password: tempPassword, mustChangePassword: true,
            rounds: userService.TEMP_PASSWORD_BCRYPT_ROUNDS,
          });
          userId = user._id;
        }
        await studentService.createRecord({
          userId, cohortId, fullName: plan.fullName,
          averageScore: plan.averageScore, performanceCategory: plan.performanceCategory,
        });
        writeResults[i] = { bucket: 'created', entry: { row: plan.rowNum, studentId: plan.studentId, fullName: plan.fullName, tempPassword } };
      } catch (err) {
        writeResults[i] = { bucket: 'failed', entry: { row: plan.rowNum, studentId: plan.studentId, reason: describeRowError(err) } };
      }
    });

    for (const { bucket, entry } of writeResults) {
      if (bucket === 'created') created.push(entry);
      else if (bucket === 'skipped') skipped.push(entry);
      else if (bucket === 'transferred') transferred.push(entry);
      else failed.push(entry);
    }

    return { created, skipped, transferred, failed };
  },
};

module.exports = enrollmentService;
