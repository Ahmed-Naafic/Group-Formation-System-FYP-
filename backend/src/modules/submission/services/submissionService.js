const emitter                  = require('../../../common/events/emitter');
const submissionRepository     = require('../repositories/submissionRepository');
const taskRepository           = require('../../task/repositories/taskRepository');
const groupRepository          = require('../../group/repositories/groupRepository');
const studentRepository        = require('../../student/repositories/studentRepository');
const courseOfferingService    = require('../../courseOffering/services/courseOfferingService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const {
  NotFoundError, ForbiddenError, BadRequestError, ConflictError,
} = require('../../../common/errors');

// Resolves the student's group for a given task.
// Derives cohortId from task.courseOfferingId, looks up the student's record in that cohort,
// then finds the group in this offering that contains the student and is assigned to the task.
async function resolveStudentGroup(task, context) {
  const courseOfferingId = String(task.courseOfferingId?._id ?? task.courseOfferingId);
  const offering = await courseOfferingRepository.findById(courseOfferingId);
  if (!offering) throw new ForbiddenError('Course offering not found');
  const cohortId = String(offering.cohortId?._id ?? offering.cohortId);

  const studentRecord = await studentRepository.findOne({ userId: context.userId, cohortId, deletedAt: null });
  if (!studentRecord) throw new ForbiddenError('You are not enrolled in this cohort');

  const groups    = await groupRepository.findByOfferingAndMemberId(courseOfferingId, studentRecord._id);
  const assigned  = task.assignedGroups.map(g => String(g._id ?? g));
  const myGroup   = groups.find(g => assigned.length === 0 || assigned.includes(String(g._id)));
  if (!myGroup) throw new ForbiddenError('This task is not assigned to your group');

  return { group: myGroup, studentRecord };
}

async function assertCourseOfferingAccess(courseOfferingId, context) {
  return courseOfferingService.getById(courseOfferingId, context);
}

const submissionService = {
  async submit(taskId, { fileIds = [], notes }, context) {
    if (context.role !== 'student') throw new ForbiddenError('Only students can submit tasks');

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    if (task.status === 'closed') throw new BadRequestError('This task is no longer accepting submissions');

    const { group, studentRecord } = await resolveStudentGroup(task, context);

    const isLate = task.deadline && new Date() > new Date(task.deadline);
    const status = isLate ? 'late' : 'submitted';

    let submission;
    if (task.submissionType === 'individual') {
      const existing = await submissionRepository.findOne({ taskId, submittedBy: studentRecord._id });
      if (existing && ['submitted', 'reviewed'].includes(existing.status)) {
        throw new ConflictError('You have already submitted this task');
      }
      submission = await submissionRepository.upsertByStudent(taskId, studentRecord._id, {
        groupId: group._id,
        files:   fileIds,
        notes,
        status,
        submittedAt: new Date(),
      });
    } else {
      // Group mode: one submission per group
      const existing = await submissionRepository.findOne({ taskId, groupId: group._id });
      if (existing && ['submitted', 'reviewed'].includes(existing.status)) {
        throw new ConflictError('This task has already been submitted by your group');
      }
      submission = await submissionRepository.upsert(taskId, group._id, {
        submittedBy: studentRecord._id,
        files:       fileIds,
        notes,
        status,
        submittedAt: new Date(),
      });
    }

    // Notifies the offering's currently-assigned instructor — draft saves
    // (saveDraft, below) deliberately don't emit this; only a real
    // submission should land in the instructor's inbox.
    emitter.emit('submission.submitted', {
      submission, task, group, studentRecord,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return submission;
  },

  async saveDraft(taskId, { fileIds = [], notes }, context) {
    if (context.role !== 'student') throw new ForbiddenError('Only students can save drafts');

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    if (task.status === 'closed') throw new BadRequestError('This task is no longer accepting submissions');

    const { group, studentRecord } = await resolveStudentGroup(task, context);

    if (task.submissionType === 'individual') {
      const existing = await submissionRepository.findOne({ taskId, submittedBy: studentRecord._id });
      if (existing && ['submitted', 'reviewed'].includes(existing.status)) {
        throw new ConflictError('You have already submitted this task');
      }
      return submissionRepository.upsertByStudent(taskId, studentRecord._id, {
        groupId: group._id,
        files:   fileIds,
        notes,
        status:  'draft',
      });
    }

    // Group mode
    const existing = await submissionRepository.findOne({ taskId, groupId: group._id });
    if (existing && ['submitted', 'reviewed'].includes(existing.status)) {
      throw new ConflictError('This task has already been submitted by your group');
    }
    return submissionRepository.upsert(taskId, group._id, {
      submittedBy: studentRecord._id,
      files:       fileIds,
      notes,
      status:      'draft',
    });
  },

  async listByTask(taskId, context) {
    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    await assertCourseOfferingAccess(String(task.courseOfferingId?._id ?? task.courseOfferingId), context);
    return submissionRepository.findByTask(taskId);
  },

  async getById(id, context) {
    const submission = await submissionRepository.findById(id);
    if (!submission) throw new NotFoundError('Submission not found');

    if (context.role === 'student') {
      const task = await taskRepository.findById(submission.taskId);
      if (task.submissionType === 'individual') {
        const { studentRecord } = await resolveStudentGroup(task, context);
        if (String(submission.submittedBy?._id ?? submission.submittedBy) !== String(studentRecord._id)) {
          throw new ForbiddenError('Access denied');
        }
      } else {
        const { group } = await resolveStudentGroup(task, context);
        if (String(submission.groupId?._id ?? submission.groupId) !== String(group._id)) {
          throw new ForbiddenError('Access denied');
        }
      }
    } else {
      const task = await taskRepository.findById(submission.taskId);
      await assertCourseOfferingAccess(String(task.courseOfferingId?._id ?? task.courseOfferingId), context);
    }

    return submission;
  },

  async getMySubmission(taskId, context) {
    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    const { group, studentRecord } = await resolveStudentGroup(task, context);
    if (task.submissionType === 'individual') {
      const submission = await submissionRepository.findOne({ taskId, submittedBy: studentRecord._id });
      return submission ?? null;
    }
    // Group mode: return the group's shared submission
    const submission = await submissionRepository.findOne({ taskId, groupId: group._id });
    return submission ?? null;
  },

  async grade(id, grade, context) {
    const submission = await submissionRepository.findById(id);
    if (!submission) throw new NotFoundError('Submission not found');

    const task = await taskRepository.findById(submission.taskId);
    await assertCourseOfferingAccess(String(task.courseOfferingId?._id ?? task.courseOfferingId), context);

    if (!['submitted', 'late', 'reviewed'].includes(submission.status)) {
      throw new BadRequestError('Cannot grade a submission that has not been submitted yet');
    }

    const updated = await submissionRepository.updateById(id, {
      grade,
      gradedBy: context.userId,
      gradedAt: new Date(),
      status:   'reviewed',
    });

    emitter.emit('submission.graded', {
      submission: updated, task,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return updated;
  },

  // Grades one member's contribution within a group submission (overrides the
  // shared group grade for that student on reports). Individual-mode tasks
  // already grade per student via grade() above — this is group-mode only.
  async gradeMember(id, studentId, grade, context) {
    const submission = await submissionRepository.findById(id);
    if (!submission) throw new NotFoundError('Submission not found');

    const task = await taskRepository.findById(submission.taskId);
    await assertCourseOfferingAccess(String(task.courseOfferingId?._id ?? task.courseOfferingId), context);

    if (task.submissionType !== 'group') {
      throw new BadRequestError('Individual-submission tasks are graded per submission, not per member');
    }
    if (!['submitted', 'late', 'reviewed'].includes(submission.status)) {
      throw new BadRequestError('Cannot grade a submission that has not been submitted yet');
    }

    const group = await groupRepository.findById(submission.groupId?._id ?? submission.groupId);
    const isMember = (group?.memberIds ?? []).some(
      (m) => String(m._id ?? m) === String(studentId),
    );
    if (!isMember) throw new BadRequestError('Student is not a member of this submission\'s group');

    const existing = (submission.memberGrades ?? []).filter(
      (mg) => String(mg.studentId?._id ?? mg.studentId) !== String(studentId),
    );
    const updated = await submissionRepository.updateById(id, {
      memberGrades: [
        ...existing,
        { studentId, grade, gradedBy: context.userId, gradedAt: new Date() },
      ],
      status: 'reviewed',
    });

    emitter.emit('submission.memberGraded', {
      submission: updated, task, studentId, grade,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return updated;
  },
};

module.exports = submissionService;
