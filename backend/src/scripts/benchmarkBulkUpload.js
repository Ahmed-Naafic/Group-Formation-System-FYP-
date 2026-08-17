// Measures bulkUpload's wall-clock time for a moderately large file and
// confirms the classification is still correct at scale, to validate the
// fix for uploads that were slow enough to trip a client/proxy timeout
// (client sees "server sent a response that could not be read" even though
// the rows are actually being written).
//
// Self-cleaning: creates a disposable Cohort + N Students/Users, verifies,
// then deletes everything it created.
//
// Usage: node src/scripts/benchmarkBulkUpload.js [rowCount]

require('dotenv').config();
const mongoose = require('mongoose');

const ROW_COUNT = Number(process.argv[2]) || 60;
const TAG = `BULKBENCH${Date.now()}`;

function csvBuffer(count) {
  const lines = ['studentId,fullName'];
  for (let i = 1; i <= count; i++) {
    lines.push(`${TAG}${String(i).padStart(4, '0')},Bench Student ${i}`);
  }
  return Buffer.from(lines.join('\n'), 'utf8');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Department = require('../modules/department/models/Department');
  const User       = require('../modules/user/models/User');
  const Cohort     = require('../modules/cohort/models/Cohort');
  const Student    = require('../modules/student/models/Student');
  const enrollmentService = require('../modules/enrollment/services/enrollmentService');

  const department = await Department.findOne();
  const adminUser  = await User.findOne({ role: 'admin' });
  if (!department || !adminUser) {
    throw new Error('Need at least one Department and one admin User to run this benchmark.');
  }
  const context = { userId: adminUser._id, role: 'admin', ipAddress: '127.0.0.1', userAgent: 'benchmarkBulkUpload-script' };

  const cohort = await Cohort.create({
    name: TAG, departmentId: department._id,
    description: 'Disposable cohort created by benchmarkBulkUpload.js — safe to delete.',
    createdBy: adminUser._id,
  });
  console.log(`Created disposable test cohort ${cohort.name} (${cohort._id})`);
  console.log(`Uploading ${ROW_COUNT} rows...\n`);

  try {
    const start = Date.now();
    const result = await enrollmentService.bulkUpload(
      String(cohort._id), csvBuffer(ROW_COUNT), 'text/csv', 'bench.csv', false, context,
    );
    const elapsedMs = Date.now() - start;

    console.log(`created=${result.created.length} skipped=${result.skipped.length} transferred=${result.transferred.length} failed=${result.failed.length}`);
    console.log(`elapsed: ${elapsedMs}ms (${(elapsedMs / ROW_COUNT).toFixed(1)}ms/row)`);

    if (result.created.length !== ROW_COUNT) {
      console.log(`FAIL — expected ${ROW_COUNT} created, got ${result.created.length}`);
      console.log(JSON.stringify(result.failed.slice(0, 5), null, 2));
      process.exitCode = 1;
    } else {
      console.log('PASS — every row created correctly');
    }
  } finally {
    console.log('\nCleaning up disposable test data...');
    const userIds = await User.find({ studentId: new RegExp(`^${TAG}`) }).select('_id');
    await Student.deleteMany({ userId: { $in: userIds.map((u) => u._id) } });
    await User.deleteMany({ studentId: new RegExp(`^${TAG}`) });
    await Cohort.findByIdAndDelete(cohort._id);
    console.log('Cleanup complete.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\nFATAL', err);
  try { await mongoose.disconnect(); } catch { /* already disconnected */ }
  process.exit(1);
});
