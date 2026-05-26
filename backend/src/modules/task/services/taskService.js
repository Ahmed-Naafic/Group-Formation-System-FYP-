const emitter                 = require('../../../common/events/emitter');
const taskRepository          = require('../repositories/taskRepository');
const classService            = require('../../class/services/classService');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const groupRepository         = require('../../group/repositories/groupRepository');
const studentRepository       = require('../../student/repositories/studentRepository');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');

// Throws if the calling instructor/admin cannot manage tasks for this class.
async function assertWriteAccess(classId, context) {
  if (context.role === 'admin') return;
  const allowed = await courseAssignmentService.hasAccess(context.userId, String(classId));
  if (!allowed) throw new ForbiddenError('You are not assigned to this class');
}

const taskService = {
  async create(data, context) {
    await classService.getById(String(data.classId)); // confirms class exists
    await assertWriteAccess(data.classId, context);

    // Validate that all assignedGroups belong to this class
    if (data.assignedGroupIds?.length) {
      for (const gid of data.assignedGroupIds) {
        const group = await groupRepository.findById(gid);
        if (!group) throw new NotFoundError(`Group ${gid} not found`);
        if (String(group.classId?._id ?? group.classId) !== String(data.classId)) {
          throw new BadRequestError(`Group ${gid} does not belong to class ${data.classId}`);
        }
      }
    }

    const task = await taskRepository.create({
      classId:        data.classId,
      assignedGroups: data.assignedGroupIds ?? [],
      assignedBy:     context.userId,
      title:          data.title,
      description:    data.description,
      attachments:    data.attachments ?? [],
      deadline:       data.deadline,
      status:         'open',
    });

    // Populate assignedGroups so the listener can fan out to member userIds
    await task.populate({
      path: 'assignedGroups',
      populate: {
        path: 'memberIds',
        select: 'userId',
        populate: { path: 'userId', select: '_id' },
      },
    });

    emitter.emit('task.created', {
      task,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return task;
  },

  // Admin/instructor: list all tasks for a class.
  // Student: list only tasks whose assignedGroups include their groups.
  async list(classId, context) {
    if (!classId) throw new BadRequestError('classId query parameter is required');

    if (context.role === 'student') {
      const studentRecords = await studentRepository.findAll({ userId: context.userId, classId });
      if (!studentRecords.length) return [];
      const studentIds = studentRecords.map((s) => s._id);
      const groups     = await groupRepository.findByMemberIds(studentIds);
      if (!groups.length) return [];
      return taskRepository.findByGroupIds(groups.map((g) => g._id));
    }

    await assertWriteAccess(classId, context);
    return taskRepository.findByClass(classId);
  },

  async getById(id, context) {
    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task not found');

    if (context.role === 'student') {
      // Student must be a member of at least one assigned group
      const studentRecords = await studentRepository.findAll({ userId: context.userId });
      const studentIds     = studentRecords.map((s) => String(s._id));
      const assigned       = task.assignedGroups.map((g) => String(g._id ?? g));
      const groups         = await groupRepository.findByMemberIds(studentRecords.map((s) => s._id));
      const memberGroupIds = groups.map((g) => String(g._id));
      const hasAccess      = assigned.some((gid) => memberGroupIds.includes(gid));
      if (!hasAccess) throw new ForbiddenError('This task is not assigned to your group');
    } else {
      await assertWriteAccess(task.classId, context);
    }

    return task;
  },

  async update(id, updates, context) {
    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task not found');
    await assertWriteAccess(task.classId, context);

    // Only the creator or admin can update
    if (context.role !== 'admin' && String(task.assignedBy?._id ?? task.assignedBy) !== String(context.userId)) {
      throw new ForbiddenError('Only the task creator can update this task');
    }

    const allowed = ['title', 'description', 'deadline', 'status', 'assignedGroups'];
    const patch   = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) patch[key] = updates[key];
    }
    return taskRepository.updateById(id, patch);
  },

  async remove(id, context) {
    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task not found');
    await assertWriteAccess(task.classId, context);

    if (context.role !== 'admin' && String(task.assignedBy?._id ?? task.assignedBy) !== String(context.userId)) {
      throw new ForbiddenError('Only the task creator can delete this task');
    }

    await taskRepository.softDelete(id, context.userId);
  },
};

module.exports = taskService;
