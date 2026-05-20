const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const departmentService = require('../services/departmentService');

const departmentController = {
  create: asyncHandler(async (req, res) => {
    const department = await departmentService.create({
      ...req.body,
      createdBy: req.context.userId,
    });
    return sendSuccess(res, { status: 201, message: 'Department created', data: { department } });
  }),

  getAll: asyncHandler(async (req, res) => {
    const filter = req.query.facultyId ? { facultyId: req.query.facultyId } : {};
    const departments = await departmentService.getAll(filter);
    return sendSuccess(res, { data: { departments } });
  }),

  getById: asyncHandler(async (req, res) => {
    const department = await departmentService.getById(req.params.id);
    return sendSuccess(res, { data: { department } });
  }),

  update: asyncHandler(async (req, res) => {
    const department = await departmentService.update(req.params.id, req.body);
    return sendSuccess(res, { message: 'Department updated', data: { department } });
  }),

  remove: asyncHandler(async (req, res) => {
    await departmentService.softDelete(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Department deleted', data: null });
  }),
};

module.exports = departmentController;
