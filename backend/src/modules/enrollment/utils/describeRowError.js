// Translates a raw, technical error into the same clean message errorHandler.js
// already gives top-level Mongoose duplicate-key errors — a row-level failure
// should never surface "E11000 duplicate key error collection: ..." verbatim.
// Kept dependency-free (no service/model requires) so it can be unit tested
// without needing a live database connection.
function describeRowError(err) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return `Database constraint violation: duplicate value for ${field}.`;
  }
  if (err.name === 'ValidationError' && err.errors) {
    return `Database validation failed: ${Object.values(err.errors).map((e) => e.message).join('; ')}`;
  }
  return err.message || 'An unexpected error occurred while processing this row.';
}

module.exports = describeRowError;
