const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const classService = require('../services/classService');

const classController = {
  create: asyncHandler(async (req, res) => {
    const cls = await classService.create({ ...req.body, createdBy: req.context.userId });
    return sendSuccess(res, { status: 201, message: 'Class created', data: { class: cls } });
  }),

  getAll: asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.semesterId) filter.semesterId = req.query.semesterId;
    const classes = await classService.getAll(filter);
    return sendSuccess(res, { data: { classes } });
  }),

  getById: asyncHandler(async (req, res) => {
    const cls = await classService.getById(req.params.id);
    return sendSuccess(res, { data: { class: cls } });
  }),

  update: asyncHandler(async (req, res) => {
    const cls = await classService.update(req.params.id, req.body);
    return sendSuccess(res, { message: 'Class updated', data: { class: cls } });
  }),

  remove: asyncHandler(async (req, res) => {
    await classService.softDelete(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Class deleted', data: null });
  }),
};

module.exports = classController;
