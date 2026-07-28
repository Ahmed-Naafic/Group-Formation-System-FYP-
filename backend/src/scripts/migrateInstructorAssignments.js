// One-time migration: backfills InstructorAssignment records from the
// (now-removed) CourseOffering.instructorId field, then unsets that legacy
// field. Idempotent — safe to re-run (skips offerings that already have an
// assignment). Run manually: `node src/scripts/migrateInstructorAssignments.js`
require('dotenv').config();

const mongoose = require('mongoose');
const InstructorAssignment = require('../modules/instructorAssignment/models/InstructorAssignment');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('[migrate] Connected to MongoDB');

  // Native driver, not the Mongoose model — the CourseOffering schema no
  // longer declares instructorId, so a model-based query wouldn't see it.
  const offeringsCollection = mongoose.connection.db.collection('courseofferings');
  const offerings = await offeringsCollection.find({ instructorId: { $exists: true } }).toArray();

  console.log(`[migrate] Found ${offerings.length} course offering(s) with a legacy instructorId`);

  let created = 0;
  let skipped = 0;

  for (const offering of offerings) {
    const existing = await InstructorAssignment.findOne({ courseOfferingId: offering._id });
    if (existing) { skipped++; continue; }

    await InstructorAssignment.create({
      courseOfferingId: offering._id,
      instructorId:     offering.instructorId,
      startDate:         offering.createdAt ?? new Date(),
      endDate:           null,
      assignedBy:        offering.createdBy ?? null,
    });
    created++;
  }

  console.log(`[migrate] Created ${created} assignment(s), skipped ${skipped} (already migrated)`);

  const unsetResult = await offeringsCollection.updateMany(
    { instructorId: { $exists: true } },
    { $unset: { instructorId: '' } },
  );
  console.log(`[migrate] Removed legacy instructorId field from ${unsetResult.modifiedCount} offering(s)`);

  await mongoose.disconnect();
  console.log('[migrate] Done. MongoDB disconnected.');
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
