const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const workspaceService = require('../services/workspaceService');

const workspaceController = {
  // GET /api/workspaces — student lists all their group workspaces
  getAll: asyncHandler(async (req, res) => {
    const workspaces = await workspaceService.findForStudent(req.context.userId);
    return sendSuccess(res, { data: { workspaces } });
  }),

  // GET /api/workspaces/:id — any role, with ownership check inside service
  getById: asyncHandler(async (req, res) => {
    const workspace = await workspaceService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { workspace } });
  }),
};

module.exports = workspaceController;
