const AppError = require('./AppError');
const E = require('./errorCodes');

class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = []) {
    super(message, 400, E.BAD_REQUEST, details);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = []) {
    super(message, 400, E.VALIDATION_ERROR, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, E.UNAUTHORIZED);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, E.FORBIDDEN);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, E.NOT_FOUND);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, E.CONFLICT);
  }
}

class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, E.INTERNAL_ERROR);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
};
