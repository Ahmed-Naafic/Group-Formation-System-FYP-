const { NotFoundError } = require('../common/errors');

function notFound(req, _res, next) {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
