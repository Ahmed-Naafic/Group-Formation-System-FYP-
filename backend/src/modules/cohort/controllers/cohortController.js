const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const cohortService = require('../services/cohortService');

const cohortController = {
  create: asyncHandler(async (req, res) => {
    const cohort = await cohortService.create({ ...req.body, createdBy: req.context.userId });
    return sendSuccess(res, { status: 201, message: 'Cohort created', data: { cohort } });
  }),

  getAll: asyncHandler(async (req, res) => {
    const filter = req.query.departmentId ? { departmentId: req.query.departmentId } : {};
    const cohorts = await cohortService.getAll(filter);
    return sendSuccess(res, { data: { cohorts } });
  }),

  getById: asyncHandler(async (req, res) => {
    const cohort = await cohortService.getById(req.params.id);
    return sendSuccess(res, { data: { cohort } });
  }),

  update: asyncHandler(async (req, res) => {
    const cohort = await cohortService.update(req.params.id, req.body);
    return sendSuccess(res, { message: 'Cohort updated', data: { cohort } });
  }),

  remove: asyncHandler(async (req, res) => {
    await cohortService.softDelete(req.params.id, req.context.userId);
    return sendSuccess(res, { message: 'Cohort deleted', data: null });
  }),
};

module.exports = cohortController;
