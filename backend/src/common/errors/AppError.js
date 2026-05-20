class AppError extends Error {
  constructor(message, statusCode, errorCode, details = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true; // distinguishes expected errors from programming bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
