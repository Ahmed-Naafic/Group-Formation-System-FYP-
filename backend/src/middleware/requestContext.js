/**
 * Builds req.context from an already-verified JWT payload + loaded user document.
 * Called internally by the auth middleware — not mounted as a standalone middleware.
 *
 * Centralised here so multi-tenancy can be added in one place later.
 */
function buildRequestContext(decoded, user) {
  return {
    userId: user._id,
    role: user.role,
    studentId: user.studentId || null, // TODO(multi-tenant): institutionId
    scope: decoded.scope,
  };
}

module.exports = { buildRequestContext };
