const { AppError } = require('../common/errors');
const errorCodes = require('../common/errors/errorCodes');
const logger = require('../common/utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Multer errors (file size, unexpected field, etc.)
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 5 MB size limit' : err.message;
    return res.status(400).json({
      success: false,
      error: { code: errorCodes.BAD_REQUEST, message, details: [] },
    });
  }

  // Our own operational errors — check FIRST so subclasses like ValidationError
  // don't accidentally match the Mongoose name-based checks below
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack });
    }
    const body = {
      success: false,
      error: { code: err.errorCode, message: err.message, details: err.details },
    };
    // Some errors (e.g. TransferConfirmationError) attach a responseData payload
    // that the client needs alongside the error envelope.
    if (err.responseData !== undefined) body.data = err.responseData;
    return res.status(err.statusCode).json(body);
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: {
        code: errorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details,
      },
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: {
        code: errorCodes.CONFLICT,
        message: `Duplicate value for ${field}`,
        details: [],
      },
    });
  }

  // Mongoose cast error (bad ObjectId, etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: errorCodes.BAD_REQUEST,
        message: `Invalid value for field '${err.path}'`,
        details: [],
      },
    });
  }

  // Express body-parser malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        code: errorCodes.BAD_REQUEST,
        message: 'Malformed JSON in request body',
        details: [],
      },
    });
  }

  // Unknown / programming error — never expose internals
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  return res.status(500).json({
    success: false,
    error: {
      code: errorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: [],
    },
  });
}

module.exports = errorHandler;
