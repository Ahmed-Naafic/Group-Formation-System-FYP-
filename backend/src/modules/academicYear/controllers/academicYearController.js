const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const academicYearService = require('../services/academicYearService');

const academicYearController = {
  create: asyncHandler(async (req, res) => {
    const ay = await academicYearService.create({ ...req.body, createdBy: req.context.userId });
    return sendSuccess(res, { status: 201, message: 'Academic year created', data: { academicYear: ay } });
  }),

  getAll: asyncHandler(async (_req, res) => {
    const academicYears = await academicYearService.getAll();
    return sendSuccess(res, { data: { academicYears } });
  }),

  getById: asyncHandler(async (req, res) => {
    const academicYear = await academicYearService.getById(req.params.id);
    return sendSuccess(res, { data: { academicYear } });
  }),

  update: asyncHandler(async (req, res) => {
    const academicYear = await academicYearService.update(req.params.id, req.body);
    return sendSuccess(res, { message: 'Academic year updated', data: { academicYear } });
  }),

  remove: asyncHandler(async (req, res) => {
    await academicYearService.softDelete(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Academic year deleted', data: null });
  }),
};

module.exports = academicYearController;
