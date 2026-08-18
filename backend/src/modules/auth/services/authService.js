const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_LIMITED_EXPIRES_IN } = require('../../../config/env');
const userService    = require('../../user/services/userService');
const userRepository = require('../../user/repositories/userRepository');
const StorageService = require('../../../common/services/storage/StorageService');
const { UnauthorizedError, ForbiddenError, TooManyAttemptsError } = require('../../../common/errors');

const LOCKOUT_THRESHOLD = 3;
const LOCKOUT_SECONDS = 30;

const TOKEN_SCOPES = {
  FULL: 'full',
  CHANGE_PASSWORD: 'change_password',
};

// Students use the mobile app; admins/instructors use the web app. Enforced
// via the X-Client-Platform header each app sends on every request — if a
// client doesn't send it (e.g. API tooling, tests), the restriction simply
// doesn't apply, since this is a UX guard rather than the sole authorization
// boundary (every endpoint still enforces its own role checks regardless).
function assertAllowedPlatform(user, platform) {
  if (platform === 'web' && user.role === 'student') {
    throw new ForbiddenError('Students must use the mobile app to log in.');
  }
  if (platform === 'mobile' && user.role !== 'student') {
    throw new ForbiddenError('Admins and instructors must use the web app to log in.');
  }
}

const authService = {
  async login({ identifier, password, platform }) {
    const user = await userService.findByIdentifier(identifier.trim());

    // Deliberate vague message — don't reveal whether the identifier exists
    if (!user) throw new UnauthorizedError('Invalid credentials');
    // Two different deactivation mechanisms land here: isActive:false (staff
    // accounts, via userService.setActive) and deletedAt (student accounts,
    // via softDelete) — both mean "this account cannot log in right now",
    // and both need the specific message below rather than falling through
    // to the generic invalid-credentials one. findByIdentifier deliberately
    // includes soft-deleted accounts so this check can actually see them.
    if (user.deletedAt || !user.isActive) {
      throw new ForbiddenError('This account has been deactivated. Contact an administrator for assistance.');
    }
    assertAllowedPlatform(user, platform);

    // Already locked out from a prior burst of wrong attempts — re-report
    // the remaining time rather than checking the password again, so
    // retrying during the lockout can't reset or extend it.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const retryAfterSeconds = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000));
      throw new TooManyAttemptsError(retryAfterSeconds);
    }

    const passwordMatch = await userService.verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      const updated = await userRepository.incrementFailedAttempts(user._id);
      if (updated.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
        await userRepository.lockAccount(user._id, new Date(Date.now() + LOCKOUT_SECONDS * 1000));
        throw new TooManyAttemptsError(LOCKOUT_SECONDS);
      }
      throw new UnauthorizedError('Invalid credentials');
    }
    await userRepository.resetLoginAttempts(user._id);

    await userService.updateLastLogin(user._id);

    if (user.mustChangePassword) {
      return {
        mustChangePassword: true,
        token: authService._generateLimitedToken(user._id),
        user: null,
      };
    }

    return {
      mustChangePassword: false,
      token: authService._generateFullToken(user),
      user: authService._sanitizeUser(user),
    };
  },

  async changePassword({ userId, newPassword, currentPassword }) {
    if (currentPassword !== undefined) {
      // Voluntary change — verify current password first
      const user = await userService.findByIdWithPassword(userId);
      if (!user) throw new UnauthorizedError('User not found');

      const match = await userService.verifyPassword(currentPassword, user.passwordHash);
      if (!match) throw new UnauthorizedError('Current password is incorrect');
    }

    const updatedUser = await userService.updatePassword(userId, newPassword);
    if (!updatedUser) throw new UnauthorizedError('User not found');

    return {
      token: authService._generateFullToken(updatedUser),
      user: authService._sanitizeUser(updatedUser),
    };
  },

  _generateFullToken(user) {
    return jwt.sign(
      {
        sub: user._id.toString(),
        role: user.role,
        studentId: user.studentId || null,
        scope: TOKEN_SCOPES.FULL,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  },

  _generateLimitedToken(userId) {
    return jwt.sign(
      {
        sub: userId.toString(),
        scope: TOKEN_SCOPES.CHANGE_PASSWORD,
      },
      JWT_SECRET,
      { expiresIn: JWT_LIMITED_EXPIRES_IN }
    );
  },

  async uploadAvatar(userId, multerFile) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');

    // Delete previous avatar from Supabase if one exists
    if (user.avatarPublicId) {
      await StorageService.delete(user.avatarPublicId).catch(() => {});
    }

    const { publicId } = await StorageService.save(
      multerFile.buffer,
      multerFile.originalname,
      `avatars/${userId}`,
      multerFile.mimetype,
    );

    // Use a signed URL — the bucket is private, so public URLs return 403.
    // 10-year expiry is effectively permanent for a profile picture.
    const signedUrl = await StorageService.createSignedUrl(publicId, 10 * 365 * 24 * 3600);

    const updated = await userRepository.updateById(userId, {
      avatarUrl:      signedUrl,
      avatarPublicId: publicId,
    });
    return authService._sanitizeUser(updated);
  },

  async removeAvatar(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');

    if (user.avatarPublicId) {
      await StorageService.delete(user.avatarPublicId).catch(() => {});
    }

    const updated = await userRepository.updateById(userId, {
      avatarUrl:      null,
      avatarPublicId: null,
    });
    return authService._sanitizeUser(updated);
  },

  _sanitizeUser(user) {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.passwordHash;
    delete obj.__v;
    return obj;
  },
};

module.exports = { authService, TOKEN_SCOPES };
