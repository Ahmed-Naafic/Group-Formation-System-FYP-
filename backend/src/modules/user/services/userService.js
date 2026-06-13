const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../../common/errors');

const BCRYPT_ROUNDS = 12;

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
    return userRepository.create({ ...rest, passwordHash });
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

  async updateInstructor(id, { fullName, email, password }) {
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== 'instructor') {
      throw new ForbiddenError('Can only update instructor accounts');
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

    return userRepository.updateById(id, updates);
  },

  async setActive(id, isActive, requestingUserId) {
    if (String(id) === String(requestingUserId)) {
      throw new ForbiddenError('You cannot change your own active status');
    }
    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== 'instructor') {
      throw new ForbiddenError('Active status can only be changed for instructor accounts');
    }
    return userRepository.updateById(id, { isActive });
  },
};

module.exports = userService;
