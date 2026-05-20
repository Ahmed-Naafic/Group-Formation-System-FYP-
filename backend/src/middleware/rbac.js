const { ForbiddenError } = require('../common/errors');

/**
 * Returns middleware that restricts access to requests whose req.context.role
 * matches one of the provided roles. Must be mounted after authenticate.
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.context) {
      return next(new ForbiddenError('Authentication context missing'));
    }
    if (!roles.includes(req.context.role)) {
      return next(new ForbiddenError('Insufficient permissions for this action'));
    }
    return next();
  };
}

module.exports = { requireRole };
