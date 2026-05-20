const studentRepository = require('../../student/repositories/studentRepository');
const classService = require('../../class/services/classService');
const { ForbiddenError, NotFoundError, BadRequestError } = require('../../../common/errors');

async function assertClassAccess(classId, context) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const assignedId = cls.instructorId?._id?.toString() ?? cls.instructorId?.toString();
  if (!assignedId || assignedId !== context.userId.toString()) {
    throw new ForbiddenError('You do not have access to this class');
  }
  return cls;
}

const attendanceService = {
  async updateAttendance(studentRecordId, attendance, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);
    return studentRepository.updateById(studentRecordId, { attendance });
  },

  async updateScores(studentRecordId, scores, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);

    // Dot-notation keys → $set updates only the provided fields, leaves others untouched
    const update = {};
    if (scores.midterm !== undefined) update['scores.midterm'] = scores.midterm;
    if (scores.final !== undefined) update['scores.final'] = scores.final;
    if (scores.coursework !== undefined) update['scores.coursework'] = scores.coursework;

    return studentRepository.updateById(studentRecordId, update);
  },

  async getByClass(classId, context) {
    if (!classId) throw new BadRequestError('classId query parameter is required');
    await assertClassAccess(classId, context);
    return studentRepository.findAll({ classId });
  },
};

module.exports = attendanceService;
