const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const { BadRequestError } = require('../../../common/errors');
const studentService = require('../services/studentService');
const enrollmentService = require('../../enrollment/services/enrollmentService');

const studentController = {
  // POST /api/students
  create: asyncHandler(async (req, res) => {
    const { student, tempPassword } = await studentService.create(req.body, req.context);
    return sendSuccess(res, {
      status: 201,
      message: 'Student created',
      data: { student, tempPassword: tempPassword ?? null },
    });
  }),

  // GET /api/students?cohortId=
  getAll: asyncHandler(async (req, res) => {
    const students = await studentService.getAll(req.query.cohortId, req.context);
    return sendSuccess(res, { data: { students } });
  }),

  // GET /api/students/:id
  getById: asyncHandler(async (req, res) => {
    const student = await studentService.getById(req.params.id, req.context);
    return sendSuccess(res, { data: { student } });
  }),

  // PATCH /api/students/:id
  update: asyncHandler(async (req, res) => {
    const student = await studentService.update(req.params.id, req.body, req.context);
    return sendSuccess(res, { message: 'Student updated', data: { student } });
  }),

  // GET /api/students/me  (student-facing — returns own records across cohorts)
  getMe: asyncHandler(async (req, res) => {
    const records = await studentService.getMyRecords(req.context);
    return sendSuccess(res, { data: { records } });
  }),

  // DELETE /api/students/:id
  remove: asyncHandler(async (req, res) => {
    await studentService.softDelete(req.params.id, req.context.userId, req.context);
    return sendSuccess(res, { message: 'Student deleted', data: null });
  }),

  // GET /api/students/trash?cohortId=
  getTrash: asyncHandler(async (req, res) => {
    const students = await studentService.getTrash(req.query.cohortId, req.context);
    return sendSuccess(res, { data: { students } });
  }),

  // POST /api/students/:id/restore
  restore: asyncHandler(async (req, res) => {
    const student = await studentService.restore(req.params.id, req.context);
    return sendSuccess(res, { message: 'Student restored', data: { student } });
  }),

  // DELETE /api/students/:id/permanent
  permanentDelete: asyncHandler(async (req, res) => {
    await studentService.permanentDelete(req.params.id, req.context);
    return sendSuccess(res, { message: 'Student permanently deleted', data: null });
  }),

  // POST /api/students/:id/reset-password
  resetPassword: asyncHandler(async (req, res) => {
    const result = await studentService.resetPassword(req.params.id, req.context);
    return sendSuccess(res, {
      message: 'Password reset — share the temp password with the student immediately',
      data: result,
    });
  }),

  // DELETE /api/students?cohortId=  — remove every student in a cohort at once
  clearByCohort: asyncHandler(async (req, res) => {
    const { cohortId } = req.query;
    const count = await studentService.clearByCohort(cohortId, req.context);
    return sendSuccess(res, {
      message: `${count} student${count !== 1 ? 's' : ''} removed from cohort`,
      data: { removed: count },
    });
  }),

  // POST /api/students/bulk-upload
  bulkUpload: asyncHandler(async (req, res) => {
    const { cohortId, confirmTransfers } = req.body;

    if (!req.file) {
      throw new BadRequestError('No file uploaded — attach a .csv or .xlsx file as field "file"');
    }

    const result = await enrollmentService.bulkUpload(
      cohortId,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      confirmTransfers,
      req.context,
    );

    return sendSuccess(res, {
      message: `Upload complete: ${result.created.length} created, ${result.transferred.length} transferred, ${result.skipped.length} skipped, ${result.failed.length} failed`,
      data: result,
    });
  }),
};

module.exports = studentController;
