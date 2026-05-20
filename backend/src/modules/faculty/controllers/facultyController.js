const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const facultyService = require('../services/facultyService');

const facultyController = {
  create: asyncHandler(async (req, res) => {
    const faculty = await facultyService.create({ ...req.body, createdBy: req.context.userId });
    return sendSuccess(res, { status: 201, message: 'Faculty created', data: { faculty } });
  }),

  getAll: asyncHandler(async (_req, res) => {
    const faculties = await facultyService.getAll();
    return sendSuccess(res, { data: { faculties } });
  }),

  getById: asyncHandler(async (req, res) => {
    const faculty = await facultyService.getById(req.params.id);
    return sendSuccess(res, { data: { faculty } });
  }),

  update: asyncHandler(async (req, res) => {
    const faculty = await facultyService.update(req.params.id, req.body);
    return sendSuccess(res, { message: 'Faculty updated', data: { faculty } });
  }),

  remove: asyncHandler(async (req, res) => {
    await facultyService.softDelete(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Faculty deleted', data: null });
  }),
};

module.exports = facultyController;
