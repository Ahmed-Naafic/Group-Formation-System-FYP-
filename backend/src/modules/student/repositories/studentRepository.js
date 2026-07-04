const Student = require('../models/Student');

const USER_FIELDS = 'studentId email role isActive mustChangePassword';

const studentRepository = {
  create(data) {
    return Student.create(data);
  },

  async findById(id) {
    return Student.findById(id).populate('userId', USER_FIELDS);
  },

  findAll(filter = {}) {
    return Student.find(filter).populate('userId', USER_FIELDS).sort({ fullName: 1 });
  },

  findOne(filter) {
    return Student.findOne(filter);
  },

  updateById(id, updates) {
    return Student.findByIdAndUpdate(id, updates, { new: true }).populate('userId', USER_FIELDS);
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
};

module.exports = studentRepository;
