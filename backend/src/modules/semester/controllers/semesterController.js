const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const semesterService = require('../services/semesterService');

// Semesters are entirely system-managed (see semesterService) — there is no
// create/update/delete here. This module is read-only: list (optionally
// scoped to one academic year, for the Course Offering page's cascading
// dropdown) and get-by-id.
const semesterController = {
  getAll: asyncHandler(async (req, res) => {
    const filter = req.query.academicYearId ? { academicYearId: req.query.academicYearId } : {};
    const semesters = await semesterService.getAll(filter);
    return sendSuccess(res, { data: { semesters } });
  }),

  getById: asyncHandler(async (req, res) => {
    const semester = await semesterService.getById(req.params.id);
    return sendSuccess(res, { data: { semester } });
  }),
};

module.exports = semesterController;
