const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const semesterService = require('../services/semesterService');

const semesterController = {
  create: asyncHandler(async (req, res) => {
    const semester = await semesterService.create({ ...req.body, createdBy: req.context.userId });
    return sendSuccess(res, { status: 201, message: 'Semester created', data: { semester } });
  }),

  getAll: asyncHandler(async (req, res) => {
    const filter = req.query.status ? { status: req.query.status } : {};
    const semesters = await semesterService.getAll(filter);
    return sendSuccess(res, { data: { semesters } });
  }),

  getById: asyncHandler(async (req, res) => {
    const semester = await semesterService.getById(req.params.id);
    return sendSuccess(res, { data: { semester } });
  }),

  update: asyncHandler(async (req, res) => {
    const semester = await semesterService.update(req.params.id, req.body);
    return sendSuccess(res, { message: 'Semester updated', data: { semester } });
  }),

  remove: asyncHandler(async (req, res) => {
    await semesterService.softDelete(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Semester deleted', data: null });
  }),
};

module.exports = semesterController;
