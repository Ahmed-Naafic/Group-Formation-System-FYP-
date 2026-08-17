// Live, self-cleaning verification of the Student Transfer feature.
//
// Core claim being verified: a student WITH group history (archived group +
// GroupHistory) can be transferred to another cohort — same Student _id,
// same User _id, group history left completely untouched — while Permanent
// Delete of that same student remains blocked. Also verifies transfer is
// blocked while the student is a member of a CURRENTLY ACTIVE group, and
// that transferring to the same cohort / transferring a trashed student are
// both rejected.
//
// Runs against the real database (no mock infra in this codebase). Only
// touches disposable, unmistakably-named test data it creates itself; every
// other record (Department, admin User, Course, Semester) is read-only.
//
// Usage: node src/scripts/verifyStudentTransfer.js

require('dotenv').config();
const mongoose = require('mongoose');

const TAG = `XFERVERIFY${Date.now()}`;

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function expectError(label, fn, matcher) {
  try {
    await fn();
    failures++;
    console.log(`  FAIL  ${label} — expected an error, but it succeeded`);
  } catch (err) {
    const ok = matcher ? matcher(err) : true;
    check(label, ok, `unexpected error message: ${err.message}`);
  }
}

function csvBuffer(studentId, fullName) {
  return Buffer.from(`studentId,fullName\n${studentId},${fullName}\n`, 'utf8');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Department     = require('../modules/department/models/Department');
  const User           = require('../modules/user/models/User');
  const Course         = require('../modules/course/models/Course');
  const Semester       = require('../modules/semester/models/Semester');
  const Cohort         = require('../modules/cohort/models/Cohort');
  const CourseOffering = require('../modules/courseOffering/models/CourseOffering');
  const Student        = require('../modules/student/models/Student');
  const Group          = require('../modules/group/models/Group');
  const GroupHistory   = require('../modules/grouping/models/GroupHistory');

  const enrollmentService  = require('../modules/enrollment/services/enrollmentService');
  const studentService     = require('../modules/student/services/studentService');
  const userService        = require('../modules/user/services/userService');
  const groupRepository    = require('../modules/group/repositories/groupRepository');
  const groupHistoryRepository = require('../modules/grouping/repositories/groupHistoryRepository');

  const department = await Department.findOne();
  const adminUser  = await User.findOne({ role: 'admin' });
  const course     = await Course.findOne();
  const semester   = await Semester.findOne();
  if (!department || !adminUser || !course || !semester) {
    throw new Error('Need at least one Department, admin User, Course, and Semester in the database to run this verification.');
  }
  const context = { userId: adminUser._id, role: 'admin', ipAddress: '127.0.0.1', userAgent: 'verifyStudentTransfer-script' };

  const cohortA = await Cohort.create({ name: `${TAG}-A`, departmentId: department._id, createdBy: adminUser._id });
  const cohortB = await Cohort.create({ name: `${TAG}-B`, departmentId: department._id, createdBy: adminUser._id });
  const cohortC = await Cohort.create({ name: `${TAG}-C`, departmentId: department._id, createdBy: adminUser._id });
  console.log(`Created disposable cohorts: ${cohortA.name}, ${cohortB.name}, ${cohortC.name}\n`);

  const offeringA = await CourseOffering.create({
    courseId: course._id, cohortId: cohortA._id, semesterId: semester._id, createdBy: adminUser._id,
  });
  const offeringB = await CourseOffering.create({
    courseId: course._id, cohortId: cohortB._id, semesterId: semester._id, createdBy: adminUser._id,
  });

  const createdCohortIds = [cohortA._id, cohortB._id, cohortC._id];
  const createdOfferingIds = [offeringA._id, offeringB._id];
  const createdGroupIds = [];
  const createdHistoryIds = [];
  let studentId = null;
  let userId = null;

  try {
    // ── Set up: a student in Cohort A with group history ────────────────────
    const imported = await enrollmentService.bulkUpload(
      String(cohortA._id), csvBuffer(TAG, 'Transfer Verify Student'), 'text/csv', 'test.csv', false, context,
    );
    check('setup: student created in Cohort A', imported.created.length === 1, JSON.stringify(imported));

    let student = await studentService.getAll(String(cohortA._id), context).then((list) => list[0]);
    studentId = student._id;
    userId = String(student.userId?._id ?? student.userId);

    const archivedGroup = await Group.create({
      courseOfferingId: offeringA._id, name: 'Archived Group', leaderId: studentId, memberIds: [studentId],
      generationId: new mongoose.Types.ObjectId(), status: 'archived', createdBy: adminUser._id,
    });
    createdGroupIds.push(archivedGroup._id);
    const history = await GroupHistory.create({
      courseOfferingId: offeringA._id, generationId: archivedGroup.generationId,
      memberIds: [studentId], leaderId: studentId, groupSize: 1,
    });
    createdHistoryIds.push(history._id);

    check('setup: student has a group-formation footprint (archived group)', await groupRepository.existsWithMember(studentId));
    check('setup: student has group history (GroupHistory)', await groupHistoryRepository.existsWithStudent(studentId));
    check('setup: student is NOT in an active group yet', !(await groupRepository.existsInActiveGroup(studentId)));

    // ── Case: same-cohort transfer is rejected ───────────────────────────────
    await expectError(
      'transfer to the SAME cohort is rejected',
      () => studentService.transfer(studentId, cohortA._id, context),
      (err) => /already in this cohort/i.test(err.message),
    );

    // ── THE core claim: transfer succeeds despite group history ─────────────
    console.log('\nTransfer — student HAS group history (archived group + GroupHistory):');
    const transferred = await studentService.transfer(studentId, cohortB._id, context);
    check('transfer succeeded despite group history', !!transferred);
    check('same Student _id (not a new record)', String(transferred._id) === String(studentId));
    check('same User _id (not a new account)', String(transferred.userId?._id ?? transferred.userId) === userId);
    check('cohortId updated to the destination cohort', String(transferred.cohortId) === String(cohortB._id));

    student = await studentService.getById(studentId, context);
    check('student now appears in Cohort B\'s active roster', String(student.cohortId) === String(cohortB._id));
    const rosterA = await studentService.getAll(String(cohortA._id), context);
    check('student no longer appears in Cohort A\'s roster', !rosterA.some((s) => String(s._id) === String(studentId)));

    check('archived Group is untouched (still references this student)', await groupRepository.existsWithMember(studentId));
    check('GroupHistory is untouched (still references this student)', await groupHistoryRepository.existsWithStudent(studentId));

    // ── Permanent Delete must still be blocked by that same group history ───
    console.log('\nPermanent Delete — must still be blocked (Transfer != Delete):');
    await userService.deleteStudentAccount(userId, context);
    await studentService.softDelete(studentId, context.userId, context);
    await expectError(
      'permanentDelete is still blocked by group history after transfer',
      () => studentService.permanentDelete(studentId, context),
      (err) => /group formation history/i.test(err.message),
    );
    // Restore for the rest of the scenarios (auto-reactivates the account).
    await studentService.restore(studentId, context);

    // ── Case: transfer blocked while a CURRENT active group member ──────────
    console.log('\nTransfer blocked while a member of a CURRENTLY ACTIVE group:');
    const activeGroup = await Group.create({
      courseOfferingId: offeringB._id, name: 'Active Group', leaderId: studentId, memberIds: [studentId],
      generationId: new mongoose.Types.ObjectId(), status: 'active', createdBy: adminUser._id,
    });
    createdGroupIds.push(activeGroup._id);

    await expectError(
      'transfer is blocked while in an active group',
      () => studentService.transfer(studentId, cohortC._id, context),
      (err) => /active group/i.test(err.message),
    );

    // Resolve it (archive the group) and confirm transfer now succeeds.
    await Group.updateOne({ _id: activeGroup._id }, { $set: { status: 'archived' } });
    const secondTransfer = await studentService.transfer(studentId, cohortC._id, context);
    check('transfer succeeds once the active group is archived', String(secondTransfer.cohortId) === String(cohortC._id));

    // ── Case: transferring a TRASHED student is rejected ─────────────────────
    console.log('\nTransfer of a trashed student is rejected:');
    await userService.deleteStudentAccount(userId, context);
    await studentService.softDelete(studentId, context.userId, context);
    await expectError(
      'transfer of a trashed student is rejected (not found in the active roster)',
      () => studentService.transfer(studentId, cohortA._id, context),
    );
    await studentService.restore(studentId, context);
  } finally {
    console.log('\nCleaning up disposable test data...');
    if (studentId) {
      await User.findByIdAndDelete(userId);
      await Student.findByIdAndDelete(studentId);
    }
    if (createdHistoryIds.length) await GroupHistory.deleteMany({ _id: { $in: createdHistoryIds } });
    if (createdGroupIds.length) await Group.deleteMany({ _id: { $in: createdGroupIds } });
    if (createdOfferingIds.length) await CourseOffering.deleteMany({ _id: { $in: createdOfferingIds } });
    if (createdCohortIds.length) await Cohort.deleteMany({ _id: { $in: createdCohortIds } });
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
