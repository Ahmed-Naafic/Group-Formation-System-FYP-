const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const { BadRequestError } = require('../../../common/errors');
const studentService = require('../services/studentService');
const enrollmentService = require('../../enrollment/services/enrollmentService');

const studentController = {
  // POST /api/students — single manual creation
  create: asyncHandler(async (req, res) => {
    const { student, tempPassword } = await studentService.create(req.body, req.context);

    return sendSuccess(res, {
      status: 201,
      message: 'Student created',
      data: {
        student,
        // null when the student already had an account in another class
        tempPassword: tempPassword ?? null,
      },
    });
  }),

  // GET /api/students?classId=
  getAll: asyncHandler(async (req, res) => {
    const students = await studentService.getAll(req.query.classId, req.context);
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

  // DELETE /api/students/:id
  remove: asyncHandler(async (req, res) => {
    await studentService.softDelete(req.params.id, req.context.userId, req.context);
    return sendSuccess(res, { message: 'Student deleted', data: null });
  }),

  // POST /api/students/:id/reset-password
  resetPassword: asyncHandler(async (req, res) => {
    const result = await studentService.resetPassword(req.params.id, req.context);
    return sendSuccess(res, {
      message: 'Password reset — share the temp password with the student immediately',
      data: result,
    });
  }),

  // POST /api/students/bulk-upload
  bulkUpload: asyncHandler(async (req, res) => {
    const { classId, confirmTransfers } = req.body;

    if (!req.file) {
      throw new BadRequestError('No file uploaded — attach a .csv or .xlsx file as field "file"');
    }

    const result = await enrollmentService.bulkUpload(
      classId,
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
