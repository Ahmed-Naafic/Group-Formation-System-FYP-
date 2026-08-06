const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../../common/errors');
const instructorAssignmentRepository = require('../../instructorAssignment/repositories/instructorAssignmentRepository');
const AuditLog = require('../../auditLog/models/AuditLog');
const auditLogService = require('../../auditLog/services/auditLogService');
const passwordGenerator = require('../../../common/utils/passwordGenerator');

const BCRYPT_ROUNDS = 12;
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

  async createUser({ password, ...rest }) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
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
};

module.exports = userService;
