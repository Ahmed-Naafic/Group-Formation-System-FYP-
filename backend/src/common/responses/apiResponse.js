/**
 * Sends a standard success response.
 * @param {import('express').Response} res
 * @param {object} options
 * @param {*}      options.data        - Payload
 * @param {string} [options.message]   - Human-readable message
 * @param {number} [options.status]    - HTTP status code (default 200)
 * @param {object} [options.meta]      - Pagination or extra metadata
 */
function sendSuccess(res, { data = null, message = null, status = 200, meta = null } = {}) {
  const body = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

module.exports = { sendSuccess };
