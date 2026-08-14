const User = require('../models/User');

const userRepository = {
  findById(id) {
    return User.findById(id);
  },

  // Soft-deleted users are excluded from findById by default (softDelete
  // plugin) — needed to locate them for restore.
  findByIdIncludingDeleted(id) {
    return User.findById(id).includeSoftDeleted();
  },

  findByIdWithPassword(id) {
    return User.findById(id).select('+passwordHash');
  },

  findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  },

  findByEmailWithPassword(email) {
    return User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  },

  findByStudentId(studentId) {
    return User.findOne({ studentId });
  },

  findByStudentIdWithPassword(studentId) {
    return User.findOne({ studentId }).select('+passwordHash');
  },

  findAll(filter = {}) {
    return User.find(filter).sort({ fullName: 1 });
  },

  create(data) {
    return User.create(data);
  },

  updateById(id, updates) {
    return User.findByIdAndUpdate(id, updates, { new: true });
  },

  existsWithRole(role) {
    return User.exists({ role });
  },

  // Bulk-deactivates a set of accounts — used by
  // userService.deactivateStudentAccountsByCohort, the bulk way to satisfy
  // clearByCohort's precondition that every student's account is already
  // deactivated. Mirrors studentRepository.softDeleteAllByCohort: the
  // plugin's pre-hook doesn't run on updateMany, so { deletedAt: null } is
  // filtered explicitly to only touch accounts not already deactivated.
  async softDeleteManyByIds(userIds, deletedBy) {
    const now = new Date();
    const result = await User.updateMany(
      { _id: { $in: userIds }, deletedAt: null },
      { $set: { deletedAt: now, deletedBy } },
    );
    return result.modifiedCount;
  },

  // Mirror of softDeleteManyByIds for the restore direction — used by
  // userService.restoreStudentAccountsByCohort.
  async restoreManyByIds(userIds) {
    const result = await User.updateMany(
      { _id: { $in: userIds }, deletedAt: { $ne: null } },
      { $set: { deletedAt: null, deletedBy: null } },
    );
    return result.modifiedCount;
  },

  // Login lockout — three consecutive wrong passwords locks the account for
  // 30 seconds. incrementFailedAttempts returns the doc so the caller can
  // read the post-increment count without a second round trip.
  incrementFailedAttempts(id) {
    return User.findByIdAndUpdate(id, { $inc: { failedLoginAttempts: 1 } }, { new: true });
  },

  lockAccount(id, until) {
    return User.findByIdAndUpdate(id, { failedLoginAttempts: 0, lockedUntil: until }, { new: true });
  },

  resetLoginAttempts(id) {
    return User.findByIdAndUpdate(id, { failedLoginAttempts: 0, lockedUntil: null }, { new: true });
  },

  saveFcmToken(id, token) {
    return User.findByIdAndUpdate(id, { fcmToken: token ?? null }, { new: true });
  },

  findFcmTokensByUserIds(ids) {
    return User.find(
      { _id: { $in: ids }, fcmToken: { $type: 'string' } },
      { fcmToken: 1 }
    ).lean();
  },
};

module.exports = userRepository;
