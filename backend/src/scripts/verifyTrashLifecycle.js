// Live, self-cleaning verification of the exact reported bug:
//   Student -> Soft Delete -> Trash -> Permanent Delete -> Re-import same
//   Student -> must be CREATED, not rejected as "already exists".
//
// Runs against the real database (no mock infra exists in this codebase),
// using only a disposable, unmistakably-named test Cohort/Student/User it
// creates and deletes itself. Every other record it touches (an existing
// Department and an existing admin User) is read-only — never written to.
//
// Usage: node src/scripts/verifyTrashLifecycle.js

require('dotenv').config();
const mongoose = require('mongoose');

const TAG = `TRASHVERIFY${Date.now()}`;

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function csvBuffer(studentId, fullName) {
  return Buffer.from(`studentId,fullName\n${studentId},${fullName}\n`, 'utf8');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Department = require('../modules/department/models/Department');
  const User       = require('../modules/user/models/User');
  const Cohort     = require('../modules/cohort/models/Cohort');
  const Student    = require('../modules/student/models/Student');

  const enrollmentService = require('../modules/enrollment/services/enrollmentService');
  const studentService    = require('../modules/student/services/studentService');
  const userService       = require('../modules/user/services/userService');

  const department = await Department.findOne();
  const adminUser  = await User.findOne({ role: 'admin' });
  if (!department || !adminUser) {
    throw new Error('Need at least one Department and one admin User in the database to run this verification.');
  }

  const context = {
    userId: adminUser._id, role: 'admin',
    ipAddress: '127.0.0.1', userAgent: 'verifyTrashLifecycle-script',
  };

  const cohort = await Cohort.create({
    name: TAG,
    departmentId: department._id,
    description: 'Disposable cohort created by verifyTrashLifecycle.js — safe to delete.',
    createdBy: adminUser._id,
  });
  const cohortId = String(cohort._id);
  console.log(`Created disposable test cohort ${cohort.name} (${cohortId})\n`);

  let secondStudentId = null;
  let secondUserId = null;

  try {
    // ── Case D: real validation error ──────────────────────────────────────
    console.log('Case D — missing required field is a real FAILED row, not a generic message:');
    const missingField = await enrollmentService.bulkUpload(
      cohortId, csvBuffer('', TAG), 'text/csv', 'test.csv', false, context,
    );
    check('missing studentId row is reported as failed', missingField.failed.length === 1);
    check(
      'failure reason names the missing field',
      /studentId/.test(missingField.failed[0]?.reason ?? ''),
      missingField.failed[0]?.reason,
    );

    // ── Create the real test student (Case: first-time import) ─────────────
    console.log('\nInitial import — student does not exist yet:');
    const firstImport = await enrollmentService.bulkUpload(
      cohortId, csvBuffer(TAG, 'Verify Student'), 'text/csv', 'test.csv', false, context,
    );
    check('first import creates exactly one student', firstImport.created.length === 1, JSON.stringify(firstImport));

    let student = await studentService.getAll(cohortId, context).then((list) => list[0]);
    check('created student is findable via getAll', !!student);
    const firstUserId = String(student.userId?._id ?? student.userId);

    // ── Case A: active student already exists ───────────────────────────────
    console.log('\nCase A — re-uploading while still ACTIVE:');
    const whileActive = await enrollmentService.bulkUpload(
      cohortId, csvBuffer(TAG, 'Verify Student'), 'text/csv', 'test.csv', false, context,
    );
    check('re-upload while active is SKIPPED, not created/failed', whileActive.skipped.length === 1 && whileActive.created.length === 0);
    check(
      'skip reason says the student already exists (not trash)',
      /already exists in this cohort/i.test(whileActive.skipped[0]?.reason ?? ''),
      whileActive.skipped[0]?.reason,
    );

    // ── Soft delete: deactivate account, then remove student ───────────────
    console.log('\nSoft delete — deactivate account, then remove student:');
    await userService.deleteStudentAccount(firstUserId, context);
    const userAfterDeactivate = await userService.findById(firstUserId);
    check('linked User is no longer active after deactivation', !userAfterDeactivate);

    await studentService.softDelete(student._id, context.userId, context);
    const stillActive = await studentService.getAll(cohortId, context);
    check('soft-deleted student no longer appears in active roster', !stillActive.some((s) => String(s._id) === String(student._id)));

    // ── Case B: student in trash ─────────────────────────────────────────────
    console.log('\nCase B — re-uploading while in TRASH:');
    const whileTrashed = await enrollmentService.bulkUpload(
      cohortId, csvBuffer(TAG, 'Verify Student'), 'text/csv', 'test.csv', false, context,
    );
    check('re-upload while in trash is SKIPPED, not created', whileTrashed.skipped.length === 1 && whileTrashed.created.length === 0);
    check(
      'skip reason explicitly says "Trash" and tells the admin to restore',
      /trash/i.test(whileTrashed.skipped[0]?.reason ?? '') && /restore/i.test(whileTrashed.skipped[0]?.reason ?? ''),
      whileTrashed.skipped[0]?.reason,
    );

    const trash = await studentService.getTrash(cohortId, context);
    const trashEntry = trash.find((s) => String(s._id) === String(student._id));
    check('deleted student appears in the per-cohort trash bin', !!trashEntry);

    const allTrash = await studentService.getAllTrash(context);
    const allTrashEntry = allTrash.find((s) => String(s._id) === String(student._id));
    check('deleted student appears in the system-wide trash', !!allTrashEntry);
    check('eligibility annotation says permanent delete is allowed (no group history)', allTrashEntry?.canPermanentlyDelete === true, JSON.stringify(allTrashEntry));

    // ── Permanent delete — THE bug scenario ──────────────────────────────────
    console.log('\nPermanent delete:');
    await studentService.permanentDelete(student._id, context);

    const studentGone = await Student.findById(student._id).includeSoftDeleted();
    check('Student record is completely gone after permanent delete', !studentGone);

    const userGone = await User.findById(firstUserId).includeSoftDeleted();
    check('linked User record is completely gone (no orphan left behind)', !userGone, userGone ? `User ${firstUserId} still exists, deletedAt=${userGone.deletedAt}` : undefined);

    // ── Case C: re-import after genuine permanent deletion ──────────────────
    console.log('\nCase C — re-uploading the SAME student ID after permanent deletion (the reported bug):');
    const secondImport = await enrollmentService.bulkUpload(
      cohortId, csvBuffer(TAG, 'Verify Student'), 'text/csv', 'test.csv', false, context,
    );
    check(
      'same studentId can be imported again as a brand-new student (CREATED, not skipped/failed)',
      secondImport.created.length === 1 && secondImport.skipped.length === 0 && secondImport.failed.length === 0,
      JSON.stringify(secondImport),
    );

    if (secondImport.created.length === 1) {
      const recreated = await studentService.getAll(cohortId, context).then((list) => list[0]);
      secondStudentId = recreated?._id ?? null;
      secondUserId = String(recreated?.userId?._id ?? recreated?.userId ?? '');
    }
  } finally {
    // ── Cleanup — leave no trace in the database ────────────────────────────
    console.log('\nCleaning up disposable test data...');
    if (secondStudentId) await Student.findByIdAndDelete(secondStudentId);
    if (secondUserId) await User.findByIdAndDelete(secondUserId);
    await Cohort.findByIdAndDelete(cohort._id);
    console.log('Cleanup complete.');
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\nFATAL', err);
  try { await mongoose.disconnect(); } catch { /* already disconnected */ }
  process.exit(1);
});
