const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const { BadRequestError } = require('../../../common/errors');
const attendanceService = require('../services/attendanceService');

const attendanceController = {
  // GET /api/attendance?courseOfferingId=
  getByOffering: asyncHandler(async (req, res) => {
    const { courseOfferingId } = req.query;
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId query parameter is required');
    const records = await attendanceService.getByOffering(courseOfferingId, req.context);
    return sendSuccess(res, { data: { records } });
  }),

  // POST /api/attendance
  create: asyncHandler(async (req, res) => {
    const record = await attendanceService.create(req.body, req.context);
    return sendSuccess(res, { status: 201, message: 'Attendance record created', data: { record } });
  }),

  // POST /api/attendance/bulk
  bulkUpsert: asyncHandler(async (req, res) => {
    const result = await attendanceService.bulkUpsert(req.body, req.context);
    return sendSuccess(res, {
      message: `${result.created.length} created, ${result.updated.length} updated, ${result.skipped.length} skipped, ${result.failed.length} failed`,
      data: result,
    });
  }),

  // PATCH /api/attendance/:id
  update: asyncHandler(async (req, res) => {
    const record = await attendanceService.update(req.params.id, req.body, req.context);
    return sendSuccess(res, { message: 'Attendance updated', data: { record } });
  }),

  // DELETE /api/attendance/:id
  remove: asyncHandler(async (req, res) => {
    await attendanceService.remove(req.params.id, req.context.userId, req.context);
    return sendSuccess(res, { message: 'Attendance record deleted', data: null });
  }),
};

module.exports = attendanceController;
