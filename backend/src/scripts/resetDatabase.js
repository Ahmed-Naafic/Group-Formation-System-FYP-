// Standalone, destructive reset script — NOT wired into server startup.
// Deletes every document in every collection EXCEPT User documents whose
// role is 'admin' (all other users — students, instructors — are deleted
// too, since they live in the same `users` collection).
//
// This is irreversible. No backup is taken. Run only when you mean it.
//
// Usage:
//   node src/scripts/resetDatabase.js --yes
//
// Without --yes, it only prints what WOULD be deleted (dry run) and exits
// without touching anything.

require('dotenv').config();
const mongoose = require('mongoose');

const CONFIRM_FLAG = process.argv.includes('--yes');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .sort();

  console.log(CONFIRM_FLAG ? '=== LIVE RUN — deleting data ===' : '=== DRY RUN — nothing will be deleted ===');
  console.log('');

  let totalDeleted = 0;

  for (const name of collections) {
    const coll = db.collection(name);

    if (name === 'users') {
      const keepFilter   = { role: 'admin' };
      const deleteFilter = { role: { $ne: 'admin' } };
      const keepCount    = await coll.countDocuments(keepFilter);
      const deleteCount  = await coll.countDocuments(deleteFilter);
      console.log(`${name.padEnd(25)} keep ${keepCount} admin(s), delete ${deleteCount} other user(s)`);
      if (CONFIRM_FLAG && deleteCount > 0) {
        const result = await coll.deleteMany(deleteFilter);
        totalDeleted += result.deletedCount;
      }
      continue;
    }

    const count = await coll.countDocuments();
    console.log(`${name.padEnd(25)} delete all ${count}`);
    if (CONFIRM_FLAG && count > 0) {
      const result = await coll.deleteMany({});
      totalDeleted += result.deletedCount;
    }
  }

  console.log('');
  if (CONFIRM_FLAG) {
    console.log(`Done. ${totalDeleted} document(s) deleted across ${collections.length} collection(s).`);
    console.log('Admin user account(s) were preserved untouched.');
  } else {
    console.log('Dry run only — re-run with --yes to actually delete this data.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
