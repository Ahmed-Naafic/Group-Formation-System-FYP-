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

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503, E.SERVICE_UNAVAILABLE);
  }
}

class BadGatewayError extends AppError {
  constructor(message = 'Upstream service error') {
    super(message, 502, E.BAD_GATEWAY);
  }
}

// Thrown when an account is locked out after too many failed login
// attempts. Carries responseData so the client can drive a live countdown
// instead of just showing the message once.
class TooManyAttemptsError extends AppError {
  constructor(retryAfterSeconds = 30) {
    super(
      `Too many failed attempts. Try again in ${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}.`,
      429,
      E.TOO_MANY_ATTEMPTS,
    );
    this.responseData = { retryAfterSeconds };
  }
}

// Thrown when a bulk upload would silently move students between classes.
// Carries responseData so the error handler can include a top-level `data`
// field in the 409 response with the list of would-be transfers.
class TransferConfirmationError extends AppError {
  constructor(wouldTransfer) {
    super(
      `${wouldTransfer.length} student(s) are enrolled in other classes and would be transferred. Resubmit with confirmTransfers=true to proceed.`,
      409,
      E.TRANSFER_CONFIRMATION_REQUIRED,
    );
    this.responseData = { wouldTransfer, totalTransfers: wouldTransfer.length };
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
  ServiceUnavailableError,
  BadGatewayError,
  TransferConfirmationError,
  TooManyAttemptsError,
};
