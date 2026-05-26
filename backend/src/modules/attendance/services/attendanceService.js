const studentRepository = require('../../student/repositories/studentRepository');
const classService = require('../../class/services/classService');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const performanceService = require('../../performance/services/performanceService');
const { ForbiddenError, NotFoundError, BadRequestError } = require('../../../common/errors');

async function assertClassAccess(classId, context) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const allowed = await courseAssignmentService.hasAccess(context.userId, String(classId));
  if (!allowed) throw new ForbiddenError('You do not have access to this class');
  return cls;
}

const attendanceService = {
  async updateAttendance(studentRecordId, attendance, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);
    return studentRepository.updateById(studentRecordId, { attendance });
  },

  async updateScores(studentRecordId, averageScore, context) {
    const student = await studentRepository.findById(studentRecordId);
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(student.classId, context);

    await studentRepository.updateById(studentRecordId, { averageScore });

    // Auto-recompute performanceCategory after averageScore change
    return performanceService.recalculate(studentRecordId);
  },

  async getByClass(classId, context) {
    if (!classId) throw new BadRequestError('classId query parameter is required');
    await assertClassAccess(classId, context);
    return studentRepository.findAll({ classId });
  },
};

module.exports = attendanceService;
