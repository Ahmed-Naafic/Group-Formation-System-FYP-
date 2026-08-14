const studentRepository       = require('../repositories/studentRepository');
const userRepository          = require('../../user/repositories/userRepository');
const userService             = require('../../user/services/userService');
const cohortService           = require('../../cohort/services/cohortService');
const groupRepository         = require('../../group/repositories/groupRepository');
const groupHistoryRepository  = require('../../grouping/repositories/groupHistoryRepository');
const auditLogService         = require('../../auditLog/services/auditLogService');
const passwordGenerator       = require('../../../common/utils/passwordGenerator');
const instructorAssignmentService = require('../../instructorAssignment/services/instructorAssignmentService');
const { NotFoundError, ForbiddenError, ConflictError, BadRequestError } = require('../../../common/errors');

// Admin: unrestricted. Instructor: must have at least one active offering for this cohort.
async function assertCohortAccess(cohortId, context) {
  const cohort = await cohortService.getById(cohortId);
  if (context.role === 'admin') return cohort;
  const hasAccess = await instructorAssignmentService.hasActiveOfferingInCohort(context.userId, cohortId);
  if (!hasAccess) {
    throw new ForbiddenError('You do not have access to this cohort');
  }
  return cohort;
}

const studentService = {
  // Student-facing: returns all the caller's own records across cohorts.
  async getMyRecords(context) {
    return studentRepository.findAllByUserId(context.userId);
  },

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
  // The linked User must already be deactivated (soft-deleted) from User
  // Management before the Student profile itself can be removed — otherwise
  // a "removed" student would keep a fully working login. userService.findById
  // returns null for a soft-deleted account, so "found" means "still active".
  async softDelete(id, userId, context) {
    const student = await studentService.getById(id, context);
    const linkedUserId = student.userId?._id ?? student.userId;
    const activeUser = await userService.findById(linkedUserId);
    if (activeUser) {
      throw new ConflictError(
        "This student's user account is still active. Deactivate it first from User Management, then remove the student.",
      );
    }

    const result = await student.softDelete(userId);
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'STUDENT_DELETED',
      entityKind: 'Student', entityId: id,
      changes: { fullName: student.fullName, cohortId: student.cohortId },
    });
    return result;
  },

  // ── Restore from trash ───────────────────────────────────────────────────
  // Symmetric with softDelete's ordering rule: the linked User must already
  // be restored (active) before the Student can come back, so a restore can
  // never land the system in "Student active, User still deactivated".
  async restore(id, context) {
    const student = await studentRepository.findByIdIncludingDeleted(id);
    if (!student) throw new NotFoundError('Student not found');
    if (!student.deletedAt) throw new ConflictError('This student is not deleted');
    await assertCohortAccess(student.cohortId?._id ?? student.cohortId, context);

    const linkedUserId = student.userId?._id ?? student.userId;
    const activeUser = await userService.findById(linkedUserId);
    if (!activeUser) {
      throw new ConflictError(
        "This student's user account is still deactivated. Restore it first from User Management, then restore the student.",
      );
    }

    const result = await student.restore();
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'STUDENT_RESTORED',
      entityKind: 'Student', entityId: id,
      changes: { fullName: student.fullName },
    });
    return result;
  },

  // ── Permanent delete from trash ──────────────────────────────────────────
  // Only allowed when the student has no group-formation footprint at all —
  // current OR archived Groups, and GroupHistory (which has no soft-delete of
  // its own; it's an immutable record by design). Checking only *active*
  // membership would let this quietly destroy data the grouping algorithm's
  // pair-avoidance and audit trail still rely on.
  async permanentDelete(id, context) {
    const student = await studentRepository.findByIdIncludingDeleted(id);
    if (!student) throw new NotFoundError('Student not found');
    if (!student.deletedAt) {
      throw new ConflictError('Only a removed student can be permanently deleted — remove them first.');
    }
    await assertCohortAccess(student.cohortId?._id ?? student.cohortId, context);

    const [inGroups, inHistory] = await Promise.all([
      groupRepository.existsWithMember(id),
      groupHistoryRepository.existsWithStudent(id),
    ]);
    if (inGroups || inHistory) {
      throw new ConflictError('This student cannot be permanently deleted because they have group formation history.');
    }

    await studentRepository.permanentlyDelete(id);
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'STUDENT_PERMANENTLY_DELETED',
      entityKind: 'Student', entityId: id,
      changes: { fullName: student.fullName },
    });
    return { deleted: true };
  },

  // ── Trash bin ─────────────────────────────────────────────────────────────
  async getTrash(cohortId, context) {
    if (!cohortId) throw new BadRequestError('cohortId query parameter is required');
    await assertCohortAccess(cohortId, context);
    return studentRepository.findDeletedByCohort(cohortId);
  },

  // ── Internal — called by the grouping engine ─────────────────────────────
  getStudentsByCohort(cohortId) {
    return studentRepository.findAll({ cohortId, deletedAt: null });
  },

  markAsLeader(studentId) {
    return studentRepository.markAsLeader(studentId);
  },

  // Soft-deletes every active Student in the cohort in a single updateMany.
  // Admin-only bulk action — the per-student "deactivate the User first"
  // ordering rule (see softDelete) would be unworkable at roster-clear scale,
  // so this cascades the same outcome automatically: every linked User is
  // deactivated in the same operation, so no cleared student is left with a
  // working login.
  async clearByCohort(cohortId, context) {
    await assertCohortAccess(cohortId, context);
    const students = await studentRepository.findAll({ cohortId, deletedAt: null });
    const userIds  = students.map((s) => s.userId?._id ?? s.userId);

    const removed = await studentRepository.softDeleteAllByCohort(cohortId, context.userId);
    if (userIds.length > 0) {
      await userRepository.softDeleteManyByIds(userIds, context.userId);
    }

    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'COHORT_ROSTER_CLEARED',
      entityKind: 'Cohort', entityId: cohortId,
      changes: { studentsRemoved: removed },
    });
    return removed;
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
