const mongoose = require('mongoose');
const { MONGODB_URI, IS_PRODUCTION } = require('./env');

// Drops the old unique (taskId, groupId) index on Submission so individual
// submission mode (one doc per student) can coexist with group mode.
async function migrateSubmissionIndex(logger) {
  try {
    const coll = mongoose.connection.collection('submissions');
    const indexes = await coll.indexes();
    const old = indexes.find(
      (i) => i.key?.taskId === 1 && i.key?.groupId === 1 && i.unique === true,
    );
    if (old) {
      await coll.dropIndex(old.name);
      logger.info('Migration: dropped unique (taskId, groupId) index on submissions');
    }
  } catch (e) {
    // Non-fatal — worst case the old constraint stays in place
    if (logger) logger.warn('Submission index migration skipped:', e.message);
  }
}

// Drops the old email/studentId unique indexes on User if they don't yet
// exclude soft-deleted accounts, then explicitly recreates them with the
// deletedAt filter — without this, a soft-deleted account permanently blocks
// re-registering a new one at the same email/studentId. Recreated explicitly
// rather than left to Mongoose's autoIndex: a unique index with the same key
// pattern but different options can be silently skipped by the sync check
// that runs once at connection time, before this drop even happens.
async function migrateUserIndexes(logger) {
  try {
    const coll = mongoose.connection.collection('users');
    const indexes = await coll.indexes();

    const stale = indexes.filter(
      (i) => i.unique === true &&
        (i.key?.email === 1 || i.key?.studentId === 1) &&
        !('deletedAt' in (i.partialFilterExpression ?? {})),
    );
    for (const idx of stale) {
      await coll.dropIndex(idx.name);
      logger.info(`Migration: dropped stale unique index on users.${Object.keys(idx.key)[0]} (missing deletedAt filter)`);
    }

    const current = await coll.indexes();
    if (!current.some((i) => i.key?.email === 1 && i.unique)) {
      await coll.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' }, deletedAt: null } });
      logger.info('Migration: created unique email index on users (with deletedAt filter)');
    }
    if (!current.some((i) => i.key?.studentId === 1 && i.unique)) {
      await coll.createIndex({ studentId: 1 }, { unique: true, partialFilterExpression: { studentId: { $type: 'string' }, deletedAt: null } });
      logger.info('Migration: created unique studentId index on users (with deletedAt filter)');
    }
  } catch (e) {
    // Non-fatal — worst case the old constraint stays in place
    if (logger) logger.warn('User index migration skipped:', e.message);
  }
}

// Retired yearOfEntry field removed from Cohort docs; name normalized to
// uppercase (matches the new schema-level `uppercase: true` cast going
// forward — this catches data written before that cast existed); unique
// name constraint migrated from department-scoped to global + case-insensitive.
async function migrateCohortSchema(logger) {
  try {
    const coll = mongoose.connection.collection('cohorts');

    const unsetResult = await coll.updateMany(
      { yearOfEntry: { $exists: true } },
      { $unset: { yearOfEntry: '' } },
    );
    if (unsetResult.modifiedCount > 0) {
      logger.info(`Migration: removed legacy yearOfEntry field from ${unsetResult.modifiedCount} cohort(s)`);
    }

    const upperResult = await coll.updateMany(
      {},
      [{ $set: { name: { $toUpper: '$name' } } }],
    );
    if (upperResult.modifiedCount > 0) {
      logger.info(`Migration: normalized ${upperResult.modifiedCount} cohort name(s) to uppercase`);
    }

    const indexes = await coll.indexes();
    const oldNameIdx = indexes.find(
      (i) => i.unique === true && i.key?.departmentId === 1 && i.key?.name === 1,
    );
    if (oldNameIdx) {
      await coll.dropIndex(oldNameIdx.name);
      logger.info('Migration: dropped department-scoped unique (departmentId, name) index on cohorts');
    }

    const hasGlobalNameIdx = (await coll.indexes()).some(
      (i) => i.unique === true && i.key?.name === 1 && Object.keys(i.key).length === 1,
    );
    if (!hasGlobalNameIdx) {
      await coll.createIndex(
        { name: 1 },
        { unique: true, collation: { locale: 'en', strength: 2 }, partialFilterExpression: { deletedAt: null } },
      );
      logger.info('Migration: created global case-insensitive unique name index on cohorts');
    }
  } catch (e) {
    // Non-fatal — worst case the old constraint stays in place. Most likely
    // cause: a pre-existing duplicate name across departments still needs
    // manual resolution before the new unique index can be built.
    if (logger) logger.warn('Cohort schema migration skipped:', e.message);
  }
}

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

let retryCount = 0;

function connect() {
  const logger = require('../common/utils/logger');

  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(async () => {
      retryCount = 0;
      logger.info('MongoDB connected', { uri: IS_PRODUCTION ? '[hidden]' : MONGODB_URI });
      await migrateSubmissionIndex(logger);
      await migrateUserIndexes(logger);
      await migrateCohortSchema(logger);
    })
    .catch((err) => {
      retryCount += 1;
      logger.error(`MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES})`, {
        message: err.message,
      });

      if (retryCount >= MAX_RETRIES) {
        logger.error('Max MongoDB retries reached — shutting down');
        process.exit(1);
      }

      setTimeout(connect, RETRY_INTERVAL_MS);
    });
}

mongoose.connection.on('disconnected', () => {
  // Lazy-require to avoid circular dependency at module load time
  const logger = require('../common/utils/logger');
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  const logger = require('../common/utils/logger');
  logger.info('MongoDB reconnected');
});

function gracefulShutdown(signal) {
  const logger = require('../common/utils/logger');
  logger.info(`${signal} received — closing MongoDB connection`);
  mongoose.connection.close(false).then(() => {
    logger.info('MongoDB connection closed');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = { connect, connection: mongoose.connection };
