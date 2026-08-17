// One-time cleanup: finds deactivated student accounts left behind by the
// permanent-delete bug (Student.permanentDelete only removed the Student
// record, never the linked User) — a deactivated User with zero Student
// records anywhere (active or trashed) is a dead end that blocks reusing
// that studentId and incorrectly claims "restore from trash" on re-upload.
// The bug itself is now fixed (studentService.permanentDelete /
// permanentDeleteByCohort); this only cleans up accounts already stuck in
// that state from before the fix.
//
// Usage:
//   node src/scripts/purgeOrphanedStudentAccounts.js        (dry run)
//   node src/scripts/purgeOrphanedStudentAccounts.js --yes   (live)

require('dotenv').config();
const mongoose = require('mongoose');

const CONFIRM_FLAG = process.argv.includes('--yes');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const User    = require('../modules/user/models/User');
  const Student = require('../modules/student/models/Student');

  console.log(CONFIRM_FLAG ? '=== LIVE RUN ===' : '=== DRY RUN — no writes ===');
  console.log('');

  const deactivated = await User.find({
    role: 'student',
    deletedAt: { $ne: null },
    studentId: { $exists: true, $ne: null },
  }).includeSoftDeleted().lean();

  let purged = 0;
  for (const u of deactivated) {
    const remaining = await Student.countDocuments({ userId: u._id }).includeSoftDeleted();
    if (remaining > 0) continue;
    console.log(`${CONFIRM_FLAG ? 'DELETE' : 'WOULD DELETE'} orphaned account: ${u.studentId} — ${u.fullName}`);
    if (CONFIRM_FLAG) {
      await User.findByIdAndDelete(u._id);
    }
    purged++;
  }

  console.log('');
  console.log(`${purged} orphaned account(s) ${CONFIRM_FLAG ? 'purged' : 'found'}.`);
  if (!CONFIRM_FLAG) console.log('Dry run only — re-run with --yes to actually delete them.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
