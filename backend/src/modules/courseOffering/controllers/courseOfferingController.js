const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const courseOfferingService = require('../services/courseOfferingService');

const courseOfferingController = {
  create: asyncHandler(async (req, res) => {
    const offering = await courseOfferingService.create(req.body, req.context);
    return sendSuccess(res, { status: 201, message: 'Course offering created', data: { offering } });
  }),

  getAll: asyncHandler(async (req, res) => {
    const { cohortId, semesterId } = req.query;
    const filter = {};
    if (cohortId)   filter.cohortId   = cohortId;
    if (semesterId) filter.semesterId = semesterId;
    const offerings = await courseOfferingService.getAll(filter, req.context);
    return sendSuccess(res, { data: { offerings } });
  }),

  getById: asyncHandler(async (req, res) => {
    const offering = await courseOfferingService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { offering } });
  }),

  getInstructorHistory: asyncHandler(async (req, res) => {
    const history = await courseOfferingService.getInstructorHistory(req.params.id, req.context);
    return sendSuccess(res, { data: { history } });
  }),

  update: asyncHandler(async (req, res) => {
    const offering = await courseOfferingService.update(req.params.id, req.body, req.context);
    return sendSuccess(res, { message: 'Course offering updated', data: { offering } });
  }),

  remove: asyncHandler(async (req, res) => {
    await courseOfferingService.softDelete(req.params.id, req.context.userId, req.context);
    return sendSuccess(res, { message: 'Course offering deleted', data: null });
  }),
};

module.exports = courseOfferingController;
