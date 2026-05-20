const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const attendanceService = require('../services/attendanceService');

const attendanceController = {
  // POST /api/attendance
  update: asyncHandler(async (req, res) => {
    const { studentId, attendance } = req.body;
    const student = await attendanceService.updateAttendance(studentId, attendance, req.context);
    return sendSuccess(res, { message: 'Attendance updated', data: { student } });
  }),

  // POST /api/scores
  updateScores: asyncHandler(async (req, res) => {
    const { studentId, midterm, final: finalScore, coursework } = req.body;
    const student = await attendanceService.updateScores(
      studentId,
      { midterm, final: finalScore, coursework },
      req.context
    );
    return sendSuccess(res, { message: 'Scores updated', data: { student } });
  }),

  // GET /api/attendance?classId=
  getByClass: asyncHandler(async (req, res) => {
    const students = await attendanceService.getByClass(req.query.classId, req.context);
    return sendSuccess(res, { data: { students } });
  }),
};

module.exports = attendanceController;
