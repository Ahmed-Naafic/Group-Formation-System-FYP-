const feedbackRepository      = require('../repositories/feedbackRepository');
const groupRepository         = require('../../group/repositories/groupRepository');
const studentRepository       = require('../../student/repositories/studentRepository');
const taskRepository          = require('../../task/repositories/taskRepository');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');

async function assertGroupAccess(groupId, context) {
  const group = await groupRepository.findById(groupId);
  if (!group) throw new NotFoundError('Group not found');

  if (context.role === 'student') {
    const studentRecords = await studentRepository.findAll({ userId: context.userId });
    const memberIds      = group.memberIds.map((m) => String(m._id ?? m));
    const isInGroup      = studentRecords.some((s) => memberIds.includes(String(s._id)));
    if (!isInGroup) throw new ForbiddenError('You are not a member of this group');
  } else if (context.role === 'instructor') {
    const classId = String(group.classId?._id ?? group.classId);
    const allowed = await courseAssignmentService.hasAccess(context.userId, classId);
    if (!allowed) throw new ForbiddenError('You are not assigned to this class');
  }

  return group;
}

const feedbackService = {
  async submit(data, context) {
    if (context.role === 'admin') throw new ForbiddenError('Admins cannot submit feedback');

    const group = await assertGroupAccess(data.groupId, context);

    // If taskId provided, validate it belongs to this group's class
    if (data.taskId) {
      const task = await taskRepository.findById(data.taskId);
      if (!task) throw new NotFoundError('Task not found');
      const taskClassId = String(task.classId?._id ?? task.classId);
      const groupClassId = String(group.classId?._id ?? group.classId);
      if (taskClassId !== groupClassId) {
        throw new BadRequestError('Task does not belong to this group\'s class');
      }
    }

    // toUserId must be in the group (for peer feedback)
    if (data.toUserId) {
      const memberIds = group.memberIds.map((m) => {
        const userId = m.userId?._id ?? m.userId;
        return userId ? String(userId) : null;
      });
      if (!memberIds.includes(String(data.toUserId))) {
        throw new BadRequestError('Target user is not a member of this group');
      }
    }

    const isPeer = context.role === 'student';

    return feedbackRepository.create({
      groupId:    data.groupId,
      taskId:     data.taskId ?? null,
      fromUserId: context.userId,
      toUserId:   data.toUserId   ?? null,
      toGroupId:  data.toGroupId  ?? null,
      rating:     data.rating,
      comment:    data.comment,
      isPeer,
    });
  },

  async list(groupId, taskId, context) {
    if (!groupId) throw new BadRequestError('groupId query parameter is required');
    await assertGroupAccess(groupId, context);
    return feedbackRepository.findByGroup(groupId, taskId || null);
  },
};

module.exports = feedbackService;
