const asyncHandler      = require('../../../common/utils/asyncHandler');
const { sendSuccess }   = require('../../../common/responses/apiResponse');
const feedbackService   = require('../services/feedbackService');

const feedbackController = {
  // POST /api/feedback
  submit: asyncHandler(async (req, res) => {
    const feedback = await feedbackService.submit(req.body, req.context);
    return sendSuccess(res, { status: 201, data: { feedback } });
  }),

  // GET /api/feedback?groupId=&taskId=
  list: asyncHandler(async (req, res) => {
    const feedback = await feedbackService.list(req.query.groupId, req.query.taskId, req.context);
    return sendSuccess(res, { data: { feedback } });
  }),
};

module.exports = feedbackController;
