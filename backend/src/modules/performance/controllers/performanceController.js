const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const performanceService = require('../services/performanceService');

const performanceController = {
  // GET /api/performance/settings
  getSettings: asyncHandler(async (_req, res) => {
    const settings = await performanceService.getSettings();
    return sendSuccess(res, { data: { settings } });
  }),

  // PUT /api/performance/settings
  updateSettings: asyncHandler(async (req, res) => {
    const { settings, affectedCount } = await performanceService.updateSettings(req.body, req.context.userId);
    const data = { settings };
    if (affectedCount > 0) {
      data.warning = `${affectedCount} student(s) have scores that now exceed the new maximums — review and correct their scores before recalculating`;
    }
    return sendSuccess(res, {
      message: 'Settings updated — run a class recalculation to apply new values to existing students',
      data,
    });
  }),

  // POST /api/performance/recalculate/student/:studentId
  recalculateStudent: asyncHandler(async (req, res) => {
    const student = await performanceService.calculateForStudent(req.params.studentId, req.context);
    return sendSuccess(res, { message: 'Performance recalculated', data: { student } });
  }),

  // POST /api/performance/recalculate/class/:classId
  recalculateClass: asyncHandler(async (req, res) => {
    const result = await performanceService.calculateForClass(req.params.classId, req.context);
    return sendSuccess(res, {
      message: `Recalculated ${result.updated} students`,
      data: result,
    });
  }),
};

module.exports = performanceController;
