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
    const result = await performanceService.updateSettings(req.body, req.context.userId);
    return sendSuccess(res, {
      message: `Thresholds saved — ${result.recalculated} student${result.recalculated !== 1 ? 's' : ''} recalculated`,
      data: { settings: result.settings, recalculated: result.recalculated },
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

  // POST /api/performance/attendance  — update Student.attendance field
  updateAttendance: asyncHandler(async (req, res) => {
    const { studentId, attendance } = req.body;
    const student = await performanceService.updateStudentAttendance(studentId, attendance, req.context);
    return sendSuccess(res, { message: 'Attendance updated', data: { student } });
  }),

  // POST /api/performance/scores  — update Student.averageScore field
  updateScores: asyncHandler(async (req, res) => {
    const { studentId, averageScore } = req.body;
    const student = await performanceService.updateStudentScores(studentId, averageScore, req.context);
    return sendSuccess(res, { message: 'Scores updated', data: { student } });
  }),
};

module.exports = performanceController;
