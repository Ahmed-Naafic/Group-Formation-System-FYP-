const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const aiService        = require('../services/aiService');

const aiController = {
  generateTask: asyncHandler(async (req, res) => {
    const { title, description } = await aiService.generateTask(req.body.prompt);
    return sendSuccess(res, { data: { title, description } });
  }),

  generateTaskVariations: asyncHandler(async (req, res) => {
    const { prompt, groupIds } = req.body;
    const variations = await aiService.generateVariationsForGroups(prompt, groupIds, req.context);
    return sendSuccess(res, { data: { variations } });
  }),
};

module.exports = aiController;
