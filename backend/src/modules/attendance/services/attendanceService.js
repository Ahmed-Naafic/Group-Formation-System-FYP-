const attendanceRepository  = require('../repositories/attendanceRepository');
const courseOfferingService = require('../../courseOffering/services/courseOfferingService');
const studentRepository     = require('../../student/repositories/studentRepository');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

// Resolves the offering and enforces instructor-scoping in one call.
async function assertOfferingAccess(courseOfferingId, context) {
  return courseOfferingService.getById(courseOfferingId, context);
}

const attendanceService = {
  async getByOffering(courseOfferingId, context) {
    await assertOfferingAccess(courseOfferingId, context);
    return attendanceRepository.findByCourseOffering(courseOfferingId);
  },

  async create(data, context) {
    await assertOfferingAccess(data.courseOfferingId, context);
    const student = await studentRepository.findById(data.studentId);
    if (!student) throw new NotFoundError('Student not found');
    return attendanceRepository.create({ ...data, updatedBy: context.userId });
  },

  async update(id, updates, context) {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError('Attendance record not found');
    await assertOfferingAccess(String(record.courseOfferingId), context);
    return attendanceRepository.updateById(id, { ...updates, updatedBy: context.userId });
  },

  async remove(id, userId, context) {
    if (context.role !== 'admin') throw new ForbiddenError('Only admins can delete attendance records');
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError('Attendance record not found');
    return record.softDelete(userId);
  },

  // Idempotent bulk upsert: created / updated / skipped / failed per row.
  // Cohort membership check added in Step 5 once students have cohortId.
  async bulkUpsert({ courseOfferingId, records }, context) {
    await assertOfferingAccess(courseOfferingId, context);
    const created = [], updated = [], skipped = [], failed = [];

    for (const { studentId, percentage } of records) {
      const student = await studentRepository.findById(studentId);
      if (!student) {
        failed.push({ studentId, reason: 'Student not found' });
        continue;
      }

      const existing = await attendanceRepository.findActiveByStudentAndOffering(
        studentId, courseOfferingId,
      );

      if (existing) {
        if (existing.percentage === percentage) {
          skipped.push({ studentId });
        } else {
          await attendanceRepository.updateById(String(existing._id), {
            percentage,
            updatedBy: context.userId,
          });
          updated.push({ studentId, percentage });
        }
      } else {
        await attendanceRepository.create({
          studentId, courseOfferingId, percentage, updatedBy: context.userId,
        });
        created.push({ studentId, percentage });
      }
    }

    return { created, updated, skipped, failed };
  },
};

module.exports = attendanceService;
