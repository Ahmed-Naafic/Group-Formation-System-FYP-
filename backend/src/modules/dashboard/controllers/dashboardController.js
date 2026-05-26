const asyncHandler       = require('../../../common/utils/asyncHandler');
const { sendSuccess }    = require('../../../common/responses/apiResponse');
const dashboardService   = require('../services/dashboardService');

const dashboardController = {
  // GET /api/dashboard
  getStats: asyncHandler(async (req, res) => {
    const stats = await dashboardService.getStats();
    return sendSuccess(res, { data: stats });
  }),
};

module.exports = dashboardController;
