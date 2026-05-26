const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const auditLogService = require('../services/auditLogService');

const auditLogController = {
  // GET /api/audit-logs?action=&entityKind=&page=1&limit=50
  list: asyncHandler(async (req, res) => {
    const { action, entityKind, actorId, page, limit } = req.query;
    const result = await auditLogService.list({
      action,
      entityKind,
      actorId: actorId || undefined,
      page:    page  ? Number(page)  : 1,
      limit:   limit ? Number(limit) : 50,
    });
    return sendSuccess(res, { data: result });
  }),
};

module.exports = auditLogController;
