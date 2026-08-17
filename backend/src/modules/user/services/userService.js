const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../../common/errors');
const instructorAssignmentRepository = require('../../instructorAssignment/repositories/instructorAssignmentRepository');
const studentRepository = require('../../student/repositories/studentRepository');
const cohortService = require('../../cohort/services/cohortService');
const AuditLog = require('../../auditLog/models/AuditLog');
const auditLogService = require('../../auditLog/services/auditLogService');
const passwordGenerator = require('../../../common/utils/passwordGenerator');

const BCRYPT_ROUNDS = 12;
// Lower cost for randomly-generated, forced-change passwords only (bulk
// import, single student creation, admin-triggered reset) — never for a
// password a user actually chose. These are high-entropy random strings,
// not attacker-guessable, and are only ever valid until the very next
// login (mustChangePassword forces an immediate change, which re-hashes at
// full BCRYPT_ROUNDS). Still a real bcrypt hash — a temp password is a live
// credential and is never stored unhashed — just cheaper than the 12 rounds
// a bulk import of hundreds of rows can't afford to pay per row without
// risking a client/proxy timeout on the request.
const TEMP_PASSWORD_BCRYPT_ROUNDS = 10;
// Accounts managed through this "staff" CRUD surface — students have their
// own module (student create/update/delete lives in studentService, tied to
// cohort enrollment) and are never reachable through these methods.
const STAFF_ROLES = ['admin', 'instructor'];

async function assertOneActiveAdminSurvives(excludingUserId) {
  const activeAdmins = await userRepository.findAll({ role: 'admin', isActive: true });
  const remaining = activeAdmins.filter((a) => String(a._id) !== String(excludingUserId));
  if (remaining.length === 0) {
    throw new ConflictError('At least one active admin must remain');
  }
}

const userService = {
  findAll(filter = {}) {
    return userRepository.findAll(filter);
  },

  findById(id) {
    return userRepository.findById(id);
  },

  findByIdWithPassword(id) {
    return userRepository.findByIdWithPassword(id);
  },

  /**
   * Resolves an identifier to a user document that includes passwordHash.
   * Identifies emails by the presence of '@'; everything else is treated as a studentId.
   */
  findByEmail(email) {
    return userRepository.findByEmail(email);
  },

  findByIdentifier(identifier) {
    return identifier.includes('@')
      ? userRepository.findByEmailWithPassword(identifier)
      : userRepository.findByStudentIdWithPassword(identifier);
  },

  verifyPassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
  },

  hashPassword(plainText) {
    return bcrypt.hash(plainText, BCRYPT_ROUNDS);
  },

  async updatePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return userRepository.updateById(userId, { passwordHash, mustChangePassword: false });
  },

  updateLastLogin(userId) {
    return userRepository.updateById(userId, { lastLoginAt: new Date() });
  },

  adminExists() {
    return userRepository.existsWithRole('admin');
  },

  // `rounds` defaults to full strength — pass TEMP_PASSWORD_BCRYPT_ROUNDS
  // explicitly (only enrollmentService.bulkUpload and studentService.create
  // do) for a randomly-generated, forced-change password.
  async createUser({ password, rounds = BCRYPT_ROUNDS, ...rest }) {
    const passwordHash = await bcrypt.hash(password, rounds);
    const user = await userRepository.create({ ...rest, passwordHash });
    // select: false on the schema only excludes passwordHash from queries
    // (find/findOne/...) — a doc fresh off create() still carries it, so it
    // has to be stripped by hand before this ever reaches a response body.
    const obj = user.toObject();
    delete obj.passwordHash;
    return obj;
  },

  // Looks up a student-role user by their institutional studentId
  findByStudentId(studentId) {
    return userRepository.findByStudentId(studentId);
  },

  // Also finds a removed (soft-deleted) account — used to stop enrollment
  // from silently creating a duplicate identity for a studentId that
  // belongs to a removed student.
  findByStudentIdIncludingDeleted(studentId) {
    return userRepository.findByStudentIdIncludingDeleted(studentId);
  },

  // Used by password-reset flows — hashes new password and forces re-login
  async resetToTempPassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return userRepository.updateById(userId, { passwordHash, mustChangePassword: true });
  },

  // Creates an admin or instructor account (students are created through
  // studentService, tied to cohort enrollment — never through here).
  async createStaffUser({ fullName, email, password, role }, context) {
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const user = await userService.createUser({ fullName, email, role, password });
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: `${role.toUpperCase()}_CREATED`,
      entityKind: 'User', entityId: user._id,
      changes: { fullName, email, role },
    });
    return user;
  },

  async updateInstructor(id, { fullName, email, password }, context) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenError('Can only update admin or instructor accounts');
    }

    const updates = {};
    if (fullName) updates.fullName = fullName;

    if (email && email !== user.email) {
      const existing = await userRepository.findByEmail(email);
      if (existing && String(existing._id) !== String(id)) {
        throw new ConflictError('An account with this email already exists');
      }
      updates.email = email;
    }

    if (password) {
      updates.passwordHash     = await bcrypt.hash(password, BCRYPT_ROUNDS);
      updates.mustChangePassword = false;
    }

    const updated = await userRepository.updateById(id, updates);
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: `${user.role.toUpperCase()}_UPDATED`,
      entityKind: 'User', entityId: id,
      changes: { fullName, email, passwordChanged: !!password },
    });
    return updated;
  },

  // DELETE /api/users/:id dispatches here first — routes to the right
  // lifecycle depending on the target account's role, so there's a single
  // "remove this account" entry point rather than two conflicting ones.
  async remove(id, context) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (user.role === 'student') {
      return userService.deleteStudentAccount(id, context);
    }
    return userService.deleteInstructor(id, context);
  },

  async deleteInstructor(id, context) {
    const requestingUserId = context.userId;
    if (String(id) === String(requestingUserId)) {
      throw new ForbiddenError('You cannot delete your own account');
    }
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenError('Only admin or instructor accounts can be deleted');
    }
    if (user.role === 'admin') {
      await assertOneActiveAdminSurvives(id);
    }
    // Any historical instructor assignment (past or current) or audit trail
    // entry means real academic data hangs off this account — permanent
    // deletion would orphan it. Deactivate instead (see setActive below).
    const [hasAssignments, hasAuditLogs] = await Promise.all([
      instructorAssignmentRepository.existsForInstructor(id),
      AuditLog.exists({ actorId: id }),
    ]);
    if (hasAssignments || hasAuditLogs) {
      throw new ConflictError(
        `This ${user.role} has historical academic records and cannot be permanently deleted. Deactivate them instead.`,
      );
    }
    // Soft delete, same as every other entity in this app (Student,
    // CourseOffering, Group, ...) — reversible via user.restore(), unlike
    // the User.findByIdAndDelete() this replaced.
    const result = await user.softDelete(requestingUserId);
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: `${user.role.toUpperCase()}_DELETED`,
      entityKind: 'User', entityId: id,
      changes: { fullName: user.fullName, email: user.email },
    });
    return result;
  },

  // Deactivates a student's linked User account (soft-delete, same mechanism
  // as deleteInstructor) — required before the Student record itself can be
  // removed from Student Management. Unlike deleteInstructor, there's no
  // "historical data" block here: soft-delete is non-destructive and is
  // exactly the step that unlocks Student removal, so it should never itself
  // be blocked by the student's own academic history.
  async deleteStudentAccount(id, context) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== 'student') {
      throw new ForbiddenError('This action is only for student accounts');
    }
    const result = await user.softDelete(context.userId);
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'STUDENT_USER_DEACTIVATED',
      entityKind: 'User', entityId: id,
      changes: { fullName: user.fullName, studentId: user.studentId },
    });
    return result;
  },

  // Bulk-deactivates every active student account in a cohort in one shot —
  // the counterpart to studentService.clearByCohort, which now refuses to
  // clear a roster while any of its students still has a working login.
  // Doing this per-student one at a time would make a full-cohort clear
  // impractical, so this is the legitimate way to satisfy that precondition
  // at scale rather than bypassing it.
  async deactivateStudentAccountsByCohort(cohortId, context) {
    await cohortService.getById(cohortId);
    const students = await studentRepository.findAll({ cohortId, deletedAt: null });
    const userIds = students
      .map((s) => s.userId?._id ?? s.userId)
      .filter(Boolean);

    const count = userIds.length > 0
      ? await userRepository.softDeleteManyByIds(userIds, context.userId)
      : 0;

    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'COHORT_ACCOUNTS_DEACTIVATED',
      entityKind: 'Cohort', entityId: cohortId,
      changes: { accountsDeactivated: count },
    });
    return count;
  },

  // Bulk-restores every deactivated account belonging to a student currently
  // in the cohort's trash bin — the counterpart to
  // deactivateStudentAccountsByCohort, and the bulk way to satisfy
  // studentService.restoreByCohort's precondition that every student's
  // account is already active again.
  async restoreStudentAccountsByCohort(cohortId, context) {
    await cohortService.getById(cohortId);
    const deletedStudents = await studentRepository.findDeletedByCohort(cohortId);
    const userIds = deletedStudents
      .map((s) => s.userId?._id ?? s.userId)
      .filter(Boolean);

    const count = userIds.length > 0
      ? await userRepository.restoreManyByIds(userIds)
      : 0;

    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'COHORT_ACCOUNTS_RESTORED',
      entityKind: 'Cohort', entityId: cohortId,
      changes: { accountsRestored: count },
    });
    return count;
  },

  // Generic restore for any soft-deleted account (student or staff) — the
  // softDelete plugin already provides doc.restore(), this just exposes it
  // through the service/audit-log layer the same way every other mutation
  // here does. Does not touch anything beyond the User record itself —
  // callers (e.g. studentService.restore) are responsible for any ordering
  // rules around what else must be true before this is safe to call.
  async restoreUser(id, context) {
    const user = await userRepository.findByIdIncludingDeleted(id);
    if (!user) throw new NotFoundError('User not found');
    if (!user.deletedAt) throw new ConflictError('This account is not deleted');
    const result = await user.restore();
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: `${user.role.toUpperCase()}_USER_RESTORED`,
      entityKind: 'User', entityId: id,
      changes: { fullName: user.fullName },
    });
    return result;
  },

  async setActive(id, isActive, context) {
    const requestingUserId = context.userId;
    if (String(id) === String(requestingUserId)) {
      throw new ForbiddenError('You cannot change your own active status');
    }
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenError('Active status can only be changed for admin or instructor accounts');
    }
    if (user.role === 'admin' && !isActive) {
      await assertOneActiveAdminSurvives(id);
    }
    const updated = await userRepository.updateById(id, { isActive });
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: `${user.role.toUpperCase()}_${isActive ? 'ACTIVATED' : 'DEACTIVATED'}`,
      entityKind: 'User', entityId: id,
      changes: { isActive },
    });
    return updated;
  },

  // Admin-triggered reset for another staff account — mirrors
  // studentService.resetPassword. Returns the generated temp password once;
  // the account must change it on next login (mustChangePassword: true).
  async resetPassword(id, context) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenError('Can only reset passwords for admin or instructor accounts');
    }
    const tempPassword = passwordGenerator.generate();
    await userService.resetToTempPassword(id, tempPassword);
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: `${user.role.toUpperCase()}_PASSWORD_RESET`,
      entityKind: 'User', entityId: id,
      changes: {},
    });
    return { fullName: user.fullName, email: user.email, tempPassword };
  },

  // Called only by studentService.permanentDelete(ByCohort) once a student's
  // last remaining record (active or trashed, anywhere) has just been
  // permanently deleted — completes the removal so the account can't linger
  // as a dead end that blocks reusing that studentId, incorrectly telling a
  // future re-upload to "restore from trash" when there's nothing left to
  // restore. Deliberately a no-op if the account is still active: an active
  // account is a live decision the admin hasn't made yet, not this method's
  // call to make. Optional `session` threads this through the same
  // transaction as the Student deletion that triggered it.
  async permanentlyDeleteOrphanedStudentAccount(userId, session) {
    const user = await userRepository.findByIdIncludingDeleted(userId, session);
    if (!user || !user.deletedAt) return false;
    await userRepository.permanentlyDelete(userId, session);
    return true;
  },
};

userService.TEMP_PASSWORD_BCRYPT_ROUNDS = TEMP_PASSWORD_BCRYPT_ROUNDS;
module.exports = userService;
