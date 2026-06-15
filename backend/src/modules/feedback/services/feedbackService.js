const feedbackRepository       = require('../repositories/feedbackRepository');
const groupRepository          = require('../../group/repositories/groupRepository');
const studentRepository        = require('../../student/repositories/studentRepository');
const taskRepository           = require('../../task/repositories/taskRepository');
const courseOfferingService    = require('../../courseOffering/services/courseOfferingService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');

async function assertGroupAccess(groupId, context) {
  const group = await groupRepository.findById(groupId);
  if (!group) throw new NotFoundError('Group not found');

  if (context.role === 'student') {
    const studentRecords = await studentRepository.findAll({ userId: context.userId, deletedAt: null });
    const memberIds      = group.memberIds.map(m => String(m._id ?? m));
    const isInGroup      = studentRecords.some(s => memberIds.includes(String(s._id)));
    if (!isInGroup) throw new ForbiddenError('You are not a member of this group');
  } else if (context.role === 'instructor') {
    const offeringId = String(group.courseOfferingId?._id ?? group.courseOfferingId);
    // courseOfferingService.getById enforces instructor-owns-offering access
    await courseOfferingService.getById(offeringId, context);
  }

  return group;
}

const feedbackService = {
  async submit(data, context) {
    if (context.role === 'admin') throw new ForbiddenError('Admins cannot submit feedback');

    const group = await assertGroupAccess(data.groupId, context);

    // If taskId provided, validate it belongs to the same offering as the group
    if (data.taskId) {
      const task = await taskRepository.findById(data.taskId);
      if (!task) throw new NotFoundError('Task not found');
      const taskOfferingId  = String(task.courseOfferingId?._id  ?? task.courseOfferingId);
      const groupOfferingId = String(group.courseOfferingId?._id ?? group.courseOfferingId);
      if (taskOfferingId !== groupOfferingId) {
        throw new BadRequestError('Task does not belong to this group\'s course offering');
      }
    }

    // toUserId must be in the group (for peer feedback)
    if (data.toUserId) {
      const memberIds = group.memberIds.map(m => {
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
      taskId:     data.taskId    ?? null,
      fromUserId: context.userId,
      toUserId:   data.toUserId  ?? null,
      toGroupId:  data.toGroupId ?? null,
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
