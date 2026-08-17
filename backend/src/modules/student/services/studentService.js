const studentRepository       = require('../repositories/studentRepository');
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
      // A removed student's account is invisible to findByStudentId (soft-
      // delete excludes it) — check separately so this can't silently fork
      // their identity into a second, unrelated account.
      const removedUser = await userService.findByStudentIdIncludingDeleted(studentId);
      if (removedUser && removedUser.deletedAt) {
        throw new ConflictError(
          `Student ID ${studentId} belongs to a removed student. Restore them from the trash bin in ` +
          'User Management instead of creating a new record.',
        );
      }
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
    } else {
      // The account is active, but they may already have a removed
      // enrollment record for THIS exact cohort — re-adding them would
      // create a second Student under the same user in the same cohort
      // instead of just restoring the one that's already there.
      const trashedHere = await studentRepository.findTrashedForUserInCohort(user._id, cohortId);
      if (trashedHere) {
        throw new ConflictError(
          `Student ID ${studentId} already has a removed record in this cohort. Restore it from the ` +
          'trash bin instead of creating a new one.',
        );
      }
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

    const userId = student.userId?._id ?? student.userId;
    await studentRepository.permanentlyDelete(id);

    // If no trace of this user's student history remains anywhere (active or
    // trashed), their account is a dead end — complete the removal so their
    // studentId can be reused, rather than leaving an orphaned deactivated
    // account that incorrectly claims there's something left to restore.
    const remaining = await studentRepository.countAllByUserId(userId);
    if (remaining === 0) {
      await userService.permanentlyDeleteOrphanedStudentAccount(userId);
    }

    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'STUDENT_PERMANENTLY_DELETED',
      entityKind: 'Student', entityId: id,
      changes: { fullName: student.fullName },
    });
    return { deleted: true };
  },

  // Permanently deletes every removed student in a cohort that has no
  // group-formation footprint — the bulk mirror of permanentDelete, same
  // per-student check. Students with group history are silently skipped
  // (not blocking) rather than failing the whole batch, since "empty the
  // trash of everything that's safe to remove" is the actual intent — the
  // ones with history simply stay in the trash, same as if you'd clicked
  // Permanent Delete on each one individually and some got rejected.
  async permanentDeleteByCohort(cohortId, context) {
    await assertCohortAccess(cohortId, context);
    const deleted = await studentRepository.findDeletedByCohort(cohortId);
    if (deleted.length === 0) {
      throw new ConflictError('No removed students to permanently delete in this cohort');
    }

    let deletedCount = 0;
    let blockedCount = 0;
    for (const student of deleted) {
      // eslint-disable-next-line no-await-in-loop
      const [inGroups, inHistory] = await Promise.all([
        groupRepository.existsWithMember(student._id),
        groupHistoryRepository.existsWithStudent(student._id),
      ]);
      if (inGroups || inHistory) {
        blockedCount++;
        continue;
      }
      const userId = student.userId?._id ?? student.userId;
      // eslint-disable-next-line no-await-in-loop
      await studentRepository.permanentlyDelete(student._id);
      // Same dead-end cleanup as the single-student path above.
      // eslint-disable-next-line no-await-in-loop
      const remaining = await studentRepository.countAllByUserId(userId);
      if (remaining === 0) {
        // eslint-disable-next-line no-await-in-loop
        await userService.permanentlyDeleteOrphanedStudentAccount(userId);
      }
      deletedCount++;
    }

    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'COHORT_TRASH_PERMANENTLY_DELETED',
      entityKind: 'Cohort', entityId: cohortId,
      changes: { deleted: deletedCount, blockedByGroupHistory: blockedCount },
    });
    return { deleted: deletedCount, blocked: blockedCount };
  },

  // ── Trash bin ─────────────────────────────────────────────────────────────
  async getTrash(cohortId, context) {
    if (!cohortId) throw new BadRequestError('cohortId query parameter is required');
    await assertCohortAccess(cohortId, context);
    return studentRepository.findDeletedByCohort(cohortId);
  },

  // Restores every removed student in a cohort in one shot — the restore
  // mirror of clearByCohort, same ordering rule: every one of them must
  // already have an active (restored) account, or this refuses to run.
  // userService.restoreStudentAccountsByCohort is the bulk way to get there.
  async restoreByCohort(cohortId, context) {
    await assertCohortAccess(cohortId, context);
    const deleted = await studentRepository.findDeletedByCohort(cohortId);
    if (deleted.length === 0) {
      throw new ConflictError('No removed students to restore in this cohort');
    }

    const stillDeactivated = deleted.filter((s) => !s.userId || s.userId.deletedAt);
    if (stillDeactivated.length > 0) {
      throw new ConflictError(
        `${stillDeactivated.length} student${stillDeactivated.length !== 1 ? 's' : ''} in the trash still ` +
        `${stillDeactivated.length !== 1 ? 'have' : 'has'} a deactivated account. Restore all accounts ` +
        'first from User Management, then restore the roster.',
      );
    }

    const restored = await studentRepository.restoreManyByCohort(cohortId);
    await auditLogService.log({
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
      action: 'COHORT_ROSTER_RESTORED',
      entityKind: 'Cohort', entityId: cohortId,
      changes: { studentsRestored: restored },
    });
    return restored;
  },

  // ── Internal — called by the grouping engine ─────────────────────────────
  getStudentsByCohort(cohortId) {
    return studentRepository.findAll({ cohortId, deletedAt: null });
  },

  markAsLeader(studentId) {
    return studentRepository.markAsLeader(studentId);
  },

  // Soft-deletes every active Student in the cohort in a single updateMany.
  // Same ordering rule as softDelete, enforced for the whole cohort at once:
  // every student's linked User must already be deactivated (see
  // userService.deactivateStudentAccountsByCohort for the bulk way to get
  // there) — this refuses to run rather than cascading around the rule.
  async clearByCohort(cohortId, context) {
    await assertCohortAccess(cohortId, context);
    const students = await studentRepository.findAll({ cohortId, deletedAt: null });

    const stillActive = students.filter((s) => s.userId && !s.userId.deletedAt);
    if (stillActive.length > 0) {
      throw new ConflictError(
        `${stillActive.length} student${stillActive.length !== 1 ? 's' : ''} in this cohort still ` +
        `${stillActive.length !== 1 ? 'have' : 'has'} an active user account. Deactivate all accounts ` +
        'first from User Management, then clear the roster.',
      );
    }

    const removed = await studentRepository.softDeleteAllByCohort(cohortId, context.userId);
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

  // Internal — called by enrollmentService to detect a removed record for
  // the SAME cohort, so re-enrollment doesn't create a duplicate Student
  // under a user who already has a trashed one right there.
  findTrashedInCohort(userId, cohortId) {
    return studentRepository.findTrashedForUserInCohort(userId, cohortId);
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
