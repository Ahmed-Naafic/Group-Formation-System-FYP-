const studentRepository       = require('../repositories/studentRepository');
const userService             = require('../../user/services/userService');
const cohortService           = require('../../cohort/services/cohortService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const passwordGenerator       = require('../../../common/utils/passwordGenerator');
const { NotFoundError, ForbiddenError, ConflictError, BadRequestError } = require('../../../common/errors');

// Admin: unrestricted. Instructor: must have at least one active offering for this cohort.
async function assertCohortAccess(cohortId, context) {
  const cohort = await cohortService.getById(cohortId);
  if (context.role === 'admin') return cohort;
  const offerings = await courseOfferingRepository.findAll({
    cohortId,
    instructorId: context.userId,
    status: 'active',
  });
  if (!offerings || offerings.length === 0) {
    throw new ForbiddenError('You do not have access to this cohort');
  }
  return cohort;
}

const studentService = {
  // ── Called by enrollmentService to check duplicates before creating ──────────
  async existsByStudentIdAndCohort(studentId, cohortId) {
    const user = await userService.findByStudentId(studentId);
    if (!user) return false;
    const existing = await studentRepository.findOne({ userId: user._id, cohortId, deletedAt: null });
    return !!existing;
  },

  // ── Called by enrollmentService after it has created the User account ────────
  createRecord(data) {
    return studentRepository.create(data);
  },

  // ── Single manual creation (admin-only) ─────────────────────────────────────
  async create({ cohortId, studentId, fullName, averageScore }, context) {
    await assertCohortAccess(cohortId, context);

    const duplicate = await studentService.existsByStudentIdAndCohort(studentId, cohortId);
    if (duplicate) throw new ConflictError(`Student ${studentId} already exists in this cohort`);

    let user = await userService.findByStudentId(studentId);
    let tempPassword = null;

    if (!user) {
      tempPassword = passwordGenerator.generate();
      user = await userService.createUser({
        studentId,
        fullName,
        role: 'student',
        password: tempPassword,
        mustChangePassword: true,
      });
    } else if (user.role !== 'student') {
      throw new BadRequestError('A non-student account already exists with that Student ID');
    }

    const raw = await studentRepository.create({
      userId: user._id,
      cohortId,
      fullName,
      averageScore: averageScore ?? null,
    });

    const student = await studentRepository.findById(raw._id);
    return { student, tempPassword };
  },

  // ── List all students in a cohort ─────────────────────────────────────────
  async getAll(cohortId, context) {
    if (!cohortId) throw new BadRequestError('cohortId query parameter is required');
    await assertCohortAccess(cohortId, context);
    return studentRepository.findAll({ cohortId, deletedAt: null });
  },

  // ── Get one student ───────────────────────────────────────────────────────
  async getById(id, context) {
    const student = await studentRepository.findById(id);
    if (!student) throw new NotFoundError('Student not found');
    await assertCohortAccess(student.cohortId, context);
    return student;
  },

  // ── Update student info ───────────────────────────────────────────────────
  async update(id, updates, context) {
    await studentService.getById(id, context);
    if (context.role !== 'admin') {
      const { averageScore: _dropped, ...safeUpdates } = updates;
      return studentRepository.updateById(id, safeUpdates);
    }
    return studentRepository.updateById(id, updates);
  },

  // ── Soft delete ───────────────────────────────────────────────────────────
  async softDelete(id, userId, context) {
    const student = await studentService.getById(id, context);
    return student.softDelete(userId);
  },

  // ── Internal — called by the grouping engine ─────────────────────────────
  getStudentsByCohort(cohortId) {
    return studentRepository.findAll({ cohortId, deletedAt: null });
  },

  markAsLeader(studentId) {
    return studentRepository.markAsLeader(studentId);
  },

  // Soft-deletes every active Student in the cohort in a single updateMany.
  async clearByCohort(cohortId, context) {
    await assertCohortAccess(cohortId, context);
    return studentRepository.softDeleteAllByCohort(cohortId, context.userId);
  },

  // Internal — called by enrollmentService to detect cross-cohort transfers.
  findActiveInOtherCohort(userId, excludeCohortId) {
    return studentRepository.findActiveByUserId(userId, excludeCohortId);
  },

  // Internal — called by enrollmentService to archive the old record on transfer.
  archiveRecord(studentDoc, deletedBy) {
    return studentDoc.softDelete(deletedBy);
  },

  // ── Instructor-initiated password reset ──────────────────────────────────
  async resetPassword(id, context) {
    const student = await studentService.getById(id, context);
    const tempPassword = passwordGenerator.generate();
    const userId = student.userId?._id ?? student.userId;
    await userService.resetToTempPassword(userId, tempPassword);
    return {
      studentId: student.userId?.studentId ?? null,
      fullName: student.fullName,
      tempPassword,
    };
  },
};

module.exports = studentService;
