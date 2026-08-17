const Student = require('../models/Student');

const USER_FIELDS = 'studentId email role isActive mustChangePassword deletedAt';

// A Student's own deletedAt is what governs whether it shows up here — the
// linked User's deletedAt is a separate, independent lifecycle (see
// studentService.softDelete/restore's ordering rule). Populating without
// this would make `userId` silently go null the moment the account is
// deactivated, even while the Student record is still active — losing the
// only reference the UI has to that user's id (needed to show "account
// deactivated" and to restore it).
const USER_POPULATE = { path: 'userId', select: USER_FIELDS, options: { _includeSoftDeleted: true } };

const studentRepository = {
  create(data) {
    return Student.create(data);
  },

  async findById(id) {
    return Student.findById(id).populate(USER_POPULATE);
  },

  // Soft-deleted students are excluded from findById by default (softDelete
  // plugin) — needed for restore, permanent-delete, and trash-bin lookups.
  findByIdIncludingDeleted(id) {
    return Student.findById(id).includeSoftDeleted().populate(USER_POPULATE);
  },

  // Trash bin — soft-deleted students in a cohort.
  findDeletedByCohort(cohortId) {
    return Student.find({ cohortId, deletedAt: { $ne: null } })
      .includeSoftDeleted()
      .populate(USER_POPULATE)
      .sort({ deletedAt: -1 });
  },

  // Hard delete — only reached after studentService.permanentDelete has
  // already verified there's no group-formation history to preserve.
  // findByIdAndDelete isn't covered by the softDelete plugin's query
  // middleware (that only wraps find/findOne/findOneAndUpdate/countDocuments
  // /exists), so this works regardless of deletedAt.
  permanentlyDelete(id) {
    return Student.findByIdAndDelete(id);
  },

  findAll(filter = {}) {
    return Student.find(filter).populate(USER_POPULATE).sort({ fullName: 1 });
  },

  findOne(filter) {
    return Student.findOne(filter);
  },

  // Used before creating a new enrollment — if this exact (user, cohort)
  // pair already has a removed record, re-enrolling should restore it
  // instead of creating a second Student under the same user in the same
  // cohort. .includeSoftDeleted() is required here: without it the plugin's
  // own `deletedAt: null` filter would silently override the `$ne: null`
  // below and this would never find anything.
  findTrashedForUserInCohort(userId, cohortId) {
    return Student.findOne({ userId, cohortId, deletedAt: { $ne: null } }).includeSoftDeleted();
  },

  updateById(id, updates) {
    return Student.findByIdAndUpdate(id, updates, { new: true }).populate(USER_POPULATE);
  },

  // Atomically sets hasBeenLeader and increments leaderCount in one operation.
  markAsLeader(id) {
    return Student.findByIdAndUpdate(
      id,
      { $set: { hasBeenLeader: true }, $inc: { leaderCount: 1 } },
      { new: true },
    );
  },

  countByCohort(cohortId) {
    return Student.countDocuments({ cohortId, deletedAt: null });
  },

  async softDeleteAllByCohort(cohortId, deletedBy) {
    const now = new Date();
    // The softDelete plugin pre-hook does NOT run on updateMany, so we must
    // explicitly filter { deletedAt: null } to touch only active records.
    const result = await Student.updateMany(
      { cohortId, deletedAt: null },
      { $set: { deletedAt: now, deletedBy } },
    );
    return result.modifiedCount;
  },

  // Mirror of softDeleteAllByCohort for the restore direction — used by
  // studentService.restoreByCohort.
  async restoreManyByCohort(cohortId) {
    const result = await Student.updateMany(
      { cohortId, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, deletedBy: null } },
    );
    return result.modifiedCount;
  },

  // Returns the single active Student record for this user in any cohort
  // OTHER than excludeCohortId. Used by the transfer-detection logic.
  findActiveByUserId(userId, excludeCohortId) {
    return Student.findOne({ userId, cohortId: { $ne: excludeCohortId } });
  },

  // Returns all active (non-deleted) student records for a user across all cohorts.
  findAllByUserId(userId) {
    return Student.find({ userId, deletedAt: null })
      .populate('cohortId', 'name')
      .sort({ createdAt: -1 });
  },

  // Counts EVERY student record for a user, active or trashed — used after a
  // permanent delete to check whether any trace of them remains at all
  // (active enrollment or something still sitting in a trash bin).
  countAllByUserId(userId) {
    return Student.countDocuments({ userId }).includeSoftDeleted();
  },
};

module.exports = studentRepository;
