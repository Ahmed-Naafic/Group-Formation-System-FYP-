const asyncHandler  = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const groupService  = require('../services/groupService');

const groupController = {
  // POST /api/groups/generate
  generate: asyncHandler(async (req, res) => {
    const { classId, groupSize, options } = req.body;
    const { groups, summary } = await groupService.generate(classId, groupSize, options, req.context);

    const data = { groups, summary };
    if (summary.ungraded > 0) {
      data.warning = `${summary.ungraded} student(s) have no performance category and were distributed evenly across groups`;
    }

    return sendSuccess(res, {
      message: `${groups.length} group(s) generated successfully`,
      data,
    });
  }),

  // POST /api/groups/regenerate
  regenerate: asyncHandler(async (req, res) => {
    const { classId, groupSize, options } = req.body;
    const { groups, summary } = await groupService.regenerate(classId, groupSize, options, req.context);

    const data = { groups, summary };
    if (summary.ungraded > 0) {
      data.warning = `${summary.ungraded} student(s) have no performance category and were distributed evenly across groups`;
    }

    return sendSuccess(res, {
      message: `${groups.length} group(s) regenerated successfully`,
      data,
    });
  }),

  // GET /api/groups?classId=
  getByClass: asyncHandler(async (req, res) => {
    const groups = await groupService.getByClass(req.query.classId, req.context);
    return sendSuccess(res, { data: { groups } });
  }),

  // GET /api/groups/:id
  getById: asyncHandler(async (req, res) => {
    const group = await groupService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { group } });
  }),

  // PATCH /api/groups/:id
  update: asyncHandler(async (req, res) => {
    const group = await groupService.update(req.params.id, req.body, req.context);
    return sendSuccess(res, { message: 'Group updated', data: { group } });
  }),
};

module.exports = groupController;
