const asyncHandler       = require('../../../common/utils/asyncHandler');
const { sendSuccess }    = require('../../../common/responses/apiResponse');
const submissionService  = require('../services/submissionService');

const submissionController = {
  // POST /api/tasks/:taskId/submit  — finalize submission
  submit: asyncHandler(async (req, res) => {
    const submission = await submissionService.submit(
      req.params.taskId,
      req.body,
      req.context,
    );
    return sendSuccess(res, { status: 201, data: { submission } });
  }),

  // POST /api/tasks/:taskId/draft  — save draft without submitting
  saveDraft: asyncHandler(async (req, res) => {
    const submission = await submissionService.saveDraft(
      req.params.taskId,
      req.body,
      req.context,
    );
    return sendSuccess(res, { status: 201, data: { submission } });
  }),

  // GET /api/tasks/:taskId/submissions  — list all group submissions (instructor/admin)
  listByTask: asyncHandler(async (req, res) => {
    const submissions = await submissionService.listByTask(req.params.taskId, req.context);
    return sendSuccess(res, { data: { submissions } });
  }),

  // GET /api/submissions/:id
  getById: asyncHandler(async (req, res) => {
    const submission = await submissionService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { submission } });
  }),

  // PATCH /api/submissions/:id/grade
  grade: asyncHandler(async (req, res) => {
    const submission = await submissionService.grade(req.params.id, req.body.grade, req.context);
    return sendSuccess(res, { data: { submission } });
  }),
};

module.exports = submissionController;
