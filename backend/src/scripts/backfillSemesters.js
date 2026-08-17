// One-time migration: every academic year must have exactly 10 Course
// Offering semesters (1-10). Academic years created before this feature
// existed have none. This backfills them — skipping any academic year that
// already has active semesters, so it's safe to re-run and can never create
// duplicates.
//
// Usage:
//   node src/scripts/backfillSemesters.js        (dry run — no writes)
//   node src/scripts/backfillSemesters.js --yes   (live — actually creates them)

require('dotenv').config();
const mongoose = require('mongoose');

const CONFIRM_FLAG = process.argv.includes('--yes');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const AcademicYear   = require('../modules/academicYear/models/AcademicYear');
  const Semester       = require('../modules/semester/models/Semester');
  const User           = require('../modules/user/models/User');
  const semesterService = require('../modules/semester/services/semesterService');

  console.log(CONFIRM_FLAG ? '=== LIVE RUN ===' : '=== DRY RUN — no writes ===');
  console.log('');

  const admin = await User.findOne({ role: 'admin', deletedAt: null }).lean();
  if (!admin) throw new Error('No admin user found to attribute createdBy to');

  const academicYears = await AcademicYear.find().sort({ startDate: 1 }).lean();
  console.log(`Found ${academicYears.length} active academic year(s).`);
  console.log('');

  let backfilled = 0;
  let skipped    = 0;

  for (const ay of academicYears) {
    const existing = await Semester.countDocuments({ academicYearId: ay._id, deletedAt: null });
    if (existing > 0) {
      console.log(`SKIP  ${ay.name} — already has ${existing} semester(s)`);
      skipped++;
      continue;
    }
    console.log(`${CONFIRM_FLAG ? 'CREATE' : 'WOULD CREATE'} 10 semesters for ${ay.name}`);
    if (CONFIRM_FLAG) {
      await semesterService.createDefaultSemesters(ay._id, admin._id);
    }
    backfilled++;
  }

  console.log('');
  console.log(`${backfilled} academic year(s) backfilled, ${skipped} already had semesters.`);
  if (!CONFIRM_FLAG) console.log('Dry run only — re-run with --yes to actually create them.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
