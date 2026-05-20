const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const userService = require('../modules/user/services/userService');
const { UnauthorizedError, ForbiddenError } = require('../common/errors');
const errorCodes = require('../common/errors/errorCodes');
const { buildRequestContext } = require('./requestContext');
const { TOKEN_SCOPES } = require('../modules/auth/services/authService');

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/**
 * Factory that returns an auth middleware accepting only the listed token scopes.
 */
function guard(allowedScopes) {
  return async (req, _res, next) => {
    try {
      const token = extractToken(req);
      if (!token) throw new UnauthorizedError('No token provided');

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          const e = new UnauthorizedError('Token has expired');
          e.errorCode = errorCodes.TOKEN_EXPIRED;
          throw e;
        }
        const e = new UnauthorizedError('Invalid token');
        e.errorCode = errorCodes.TOKEN_INVALID;
        throw e;
      }

      if (!allowedScopes.includes(decoded.scope)) {
        const e = new ForbiddenError('Token scope insufficient for this endpoint');
        e.errorCode = errorCodes.TOKEN_SCOPE_INSUFFICIENT;
        throw e;
      }

      const user = await userService.findById(decoded.sub);
      if (!user) throw new UnauthorizedError('User no longer exists');
      if (!user.isActive) throw new ForbiddenError('Account is deactivated');

      req.context = buildRequestContext(decoded, user);
      next();
    } catch (err) {
      next(err);
    }
  };
}

const authenticate = guard([TOKEN_SCOPES.FULL]);
const authenticateForPasswordChange = guard([TOKEN_SCOPES.FULL, TOKEN_SCOPES.CHANGE_PASSWORD]);

module.exports = { authenticate, authenticateForPasswordChange };
