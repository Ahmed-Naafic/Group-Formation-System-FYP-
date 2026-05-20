const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');

const BCRYPT_ROUNDS = 12;

const userService = {
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
};

module.exports = userService;
