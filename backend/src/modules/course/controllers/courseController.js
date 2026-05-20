const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const courseService = require('../services/courseService');

const courseController = {
  create: asyncHandler(async (req, res) => {
    const course = await courseService.create({ ...req.body, createdBy: req.context.userId });
    return sendSuccess(res, { status: 201, message: 'Course created', data: { course } });
  }),

  getAll: asyncHandler(async (req, res) => {
    const filter = req.query.departmentId ? { departmentId: req.query.departmentId } : {};
    const courses = await courseService.getAll(filter);
    return sendSuccess(res, { data: { courses } });
  }),

  getById: asyncHandler(async (req, res) => {
    const course = await courseService.getById(req.params.id);
    return sendSuccess(res, { data: { course } });
  }),

  update: asyncHandler(async (req, res) => {
    const course = await courseService.update(req.params.id, req.body);
    return sendSuccess(res, { message: 'Course updated', data: { course } });
  }),

  remove: asyncHandler(async (req, res) => {
    await courseService.softDelete(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Course deleted', data: null });
  }),
};

module.exports = courseController;
