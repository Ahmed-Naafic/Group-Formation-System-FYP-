const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const aiService        = require('../services/aiService');

const aiController = {
  generateTask: asyncHandler(async (req, res) => {
    const { title, description } = await aiService.generateTask(req.body.prompt);
    return sendSuccess(res, { data: { title, description } });
  }),
};

module.exports = aiController;
