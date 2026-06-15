const emitter                  = require('../../../common/events/emitter');
const taskRepository           = require('../repositories/taskRepository');
const courseOfferingService    = require('../../courseOffering/services/courseOfferingService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const groupRepository          = require('../../group/repositories/groupRepository');
const studentRepository        = require('../../student/repositories/studentRepository');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');

// courseOfferingService.getById(id, context) enforces ownership for instructors
// and existence for everyone. Admin passes through; instructor throws if not their offering.
async function assertCourseOfferingAccess(courseOfferingId, context) {
  return courseOfferingService.getById(courseOfferingId, context);
}

const taskService = {
  async create(data, context) {
    await assertCourseOfferingAccess(data.courseOfferingId, context);

    // Validate that all assignedGroups belong to this offering
    if (data.assignedGroupIds?.length) {
      for (const gid of data.assignedGroupIds) {
        const group = await groupRepository.findById(gid);
        if (!group) throw new NotFoundError(`Group ${gid} not found`);
        const gOfferingId = String(group.courseOfferingId?._id ?? group.courseOfferingId);
        if (gOfferingId !== String(data.courseOfferingId)) {
          throw new BadRequestError(`Group ${gid} does not belong to offering ${data.courseOfferingId}`);
        }
      }
    }

    const task = await taskRepository.create({
      courseOfferingId: data.courseOfferingId,
      assignedGroups:   data.assignedGroupIds ?? [],
      assignedBy:       context.userId,
      title:            data.title,
      description:      data.description,
      attachments:      data.attachments ?? [],
      deadline:         data.deadline,
      status:           'open',
    });

    await task.populate({
      path: 'assignedGroups',
      populate: { path: 'memberIds', select: 'userId', populate: { path: 'userId', select: '_id' } },
    });

    emitter.emit('task.created', {
      task,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return task;
  },

  // Admin/instructor: list all tasks for an offering.
  // Student: list only tasks whose assignedGroups include their group in this offering.
  async list(courseOfferingId, context) {
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId query parameter is required');

    if (context.role === 'student') {
      // Load offering to get cohortId, then find the student's record and groups
      const offering = await courseOfferingRepository.findById(courseOfferingId);
      if (!offering) return [];
      const cohortId = String(offering.cohortId?._id ?? offering.cohortId);
      const studentRecord = await studentRepository.findOne({ userId: context.userId, cohortId, deletedAt: null });
      if (!studentRecord) return [];
      const groups = await groupRepository.findByOfferingAndMemberId(courseOfferingId, studentRecord._id);
      if (!groups.length) return [];
      return taskRepository.findByGroupIds(groups.map(g => g._id));
    }

    await assertCourseOfferingAccess(courseOfferingId, context);
    return taskRepository.findByOffering(courseOfferingId);
  },

  async getById(id, context) {
    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task not found');

    if (context.role === 'student') {
      const offering = await courseOfferingRepository.findById(String(task.courseOfferingId?._id ?? task.courseOfferingId));
      const cohortId = offering ? String(offering.cohortId?._id ?? offering.cohortId) : null;
      const studentRecords = cohortId
        ? await studentRepository.findAll({ userId: context.userId, cohortId, deletedAt: null })
        : [];
      const studentIds  = studentRecords.map(s => s._id);
      const groups      = await groupRepository.findByMemberIds(studentIds);
      const memberGroupIds = groups.map(g => String(g._id));
      const assigned    = task.assignedGroups.map(g => String(g._id ?? g));
      const hasAccess   = assigned.length === 0 || assigned.some(gid => memberGroupIds.includes(gid));
      if (!hasAccess) throw new ForbiddenError('This task is not assigned to your group');
    } else {
      await assertCourseOfferingAccess(String(task.courseOfferingId?._id ?? task.courseOfferingId), context);
    }

    return task;
  },

  async update(id, updates, context) {
    const task = await taskRepository.findById(id);
    if (!task) throw new NotFoundError('Task not found');
    await assertCourseOfferingAccess(String(task.courseOfferingId?._id ?? task.courseOfferingId), context);

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
    await assertCourseOfferingAccess(String(task.courseOfferingId?._id ?? task.courseOfferingId), context);

    if (context.role !== 'admin' && String(task.assignedBy?._id ?? task.assignedBy) !== String(context.userId)) {
      throw new ForbiddenError('Only the task creator can delete this task');
    }

    await taskRepository.softDelete(id, context.userId);
  },
};

module.exports = taskService;
