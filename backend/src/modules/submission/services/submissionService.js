const emitter                 = require('../../../common/events/emitter');
const submissionRepository    = require('../repositories/submissionRepository');
const taskRepository          = require('../../task/repositories/taskRepository');
const groupRepository         = require('../../group/repositories/groupRepository');
const studentRepository       = require('../../student/repositories/studentRepository');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const {
  NotFoundError, ForbiddenError, BadRequestError, ConflictError,
} = require('../../../common/errors');

// Resolves a student's group that is assigned to this task.
// Returns the group document or throws.
async function resolveStudentGroup(task, context) {
  const studentRecords = await studentRepository.findAll({
    userId:  context.userId,
    classId: task.classId,
  });
  if (!studentRecords.length) throw new ForbiddenError('You are not enrolled in this class');

  const studentIds  = studentRecords.map((s) => s._id);
  const allGroups   = await groupRepository.findByMemberIds(studentIds);
  const assigned    = task.assignedGroups.map((g) => String(g._id ?? g));
  const myGroup     = allGroups.find((g) => assigned.includes(String(g._id)));
  if (!myGroup) throw new ForbiddenError('This task is not assigned to your group');

  return { group: myGroup, studentRecord: studentRecords[0] };
}

async function assertInstructorAccess(classId, context) {
  if (context.role === 'admin') return;
  const allowed = await courseAssignmentService.hasAccess(context.userId, String(classId));
  if (!allowed) throw new ForbiddenError('You are not assigned to this class');
}

const submissionService = {
  /**
   * Student submits (or updates a draft for) a task.
   * - Creates a Submission if none exists, updates if it's still in draft.
   * - Status auto-set: 'late' if past deadline, 'submitted' otherwise.
   * - Once 'submitted', the student cannot change it again.
   */
  async submit(taskId, { fileIds = [], notes }, context) {
    if (context.role !== 'student') {
      throw new ForbiddenError('Only students can submit tasks');
    }

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    if (task.status === 'closed') throw new BadRequestError('This task is no longer accepting submissions');

    const { group, studentRecord } = await resolveStudentGroup(task, context);

    // Check if a submission already exists
    const existing = await submissionRepository.findOne({ taskId, groupId: group._id });
    if (existing && ['submitted', 'reviewed'].includes(existing.status)) {
      throw new ConflictError('This task has already been submitted and cannot be changed');
    }

    const isLate   = task.deadline && new Date() > new Date(task.deadline);
    const status   = isLate ? 'late' : 'submitted';
    const now      = new Date();

    return submissionRepository.upsert(taskId, group._id, {
      submittedBy:  studentRecord._id,
      files:        fileIds,
      notes,
      status,
      submittedAt:  now,
    });
  },

  /**
   * Saves a draft without finalising.  Student can call this multiple times.
   */
  async saveDraft(taskId, { fileIds = [], notes }, context) {
    if (context.role !== 'student') {
      throw new ForbiddenError('Only students can save drafts');
    }

    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    if (task.status === 'closed') throw new BadRequestError('This task is no longer accepting submissions');

    const { group, studentRecord } = await resolveStudentGroup(task, context);

    const existing = await submissionRepository.findOne({ taskId, groupId: group._id });
    if (existing && ['submitted', 'reviewed'].includes(existing.status)) {
      throw new ConflictError('This task has already been submitted and cannot be changed');
    }

    return submissionRepository.upsert(taskId, group._id, {
      submittedBy: studentRecord._id,
      files:       fileIds,
      notes,
      status:      'draft',
    });
  },

  /**
   * Lists all submissions for a task.  Admin/instructor only.
   */
  async listByTask(taskId, context) {
    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    await assertInstructorAccess(task.classId, context);
    return submissionRepository.findByTask(taskId);
  },

  /**
   * Get a single submission.
   * Student: only their group's submission.
   * Instructor/Admin: any submission for their class.
   */
  async getById(id, context) {
    const submission = await submissionRepository.findById(id);
    if (!submission) throw new NotFoundError('Submission not found');

    if (context.role === 'student') {
      const task           = await taskRepository.findById(submission.taskId);
      const { group }      = await resolveStudentGroup(task, context);
      if (String(submission.groupId?._id ?? submission.groupId) !== String(group._id)) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      const task = await taskRepository.findById(submission.taskId);
      await assertInstructorAccess(task.classId, context);
    }

    return submission;
  },

  /**
   * Instructor grades a submission.  Grade 0–100; status moves to 'reviewed'.
   */
  async grade(id, grade, context) {
    const submission = await submissionRepository.findById(id);
    if (!submission) throw new NotFoundError('Submission not found');

    const task = await taskRepository.findById(submission.taskId);
    await assertInstructorAccess(task.classId, context);

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
};

module.exports = submissionService;
