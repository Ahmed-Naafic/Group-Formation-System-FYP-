const workspaceRepository    = require('../repositories/workspaceRepository');
const groupRepository        = require('../../group/repositories/groupRepository');
const studentRepository      = require('../../student/repositories/studentRepository');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const Task                   = require('../../task/models/Task');
const Submission             = require('../../submission/models/Submission');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

const workspaceService = {
  // Called by groupService._persist — creates a bare workspace shell for each new group.
  createForGroup(groupId, settings = {}) {
    return workspaceRepository.create({ groupId, settings });
  },

  // Returns all workspaces for groups the logged-in student belongs to,
  // each enriched with a taskSummary ({ total, done, pending, dueSoon }).
  async findForStudent(userId) {
    const studentRecords = await studentRepository.findAll({ userId });
    if (!studentRecords.length) return [];

    const studentIds = studentRecords.map((s) => s._id);
    const groups     = await groupRepository.findByMemberIds(studentIds);
    if (!groups.length) return [];

    const workspaces = await workspaceRepository.findByGroupIds(groups.map((g) => g._id));
    if (!workspaces.length) return [];

    // Collect classIds + groupIds for bulk task/submission lookup
    const classIds = [
      ...new Set(
        workspaces.map((ws) => String(ws.groupId?.classId?._id ?? ws.groupId?.classId))
      ),
    ].filter(Boolean);
    const groupIds = workspaces.map((ws) => ws.groupId._id);

    const [tasks, submissions] = await Promise.all([
      Task.find({ classId: { $in: classIds }, deletedAt: null })
        .select('_id classId assignedGroups deadline')
        .lean(),
      Submission.find({ groupId: { $in: groupIds }, deletedAt: null })
        .select('taskId groupId status')
        .lean(),
    ]);

    // taskId-groupId → submission status
    const subMap = new Map(submissions.map((s) => [`${s.taskId}-${s.groupId}`, s.status]));

    const now         = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return workspaces.map((ws) => {
      const plain   = ws.toObject();
      const group   = ws.groupId;
      const gid     = String(group._id);
      const cid     = String(group.classId?._id ?? group.classId);

      const groupTasks = tasks.filter(
        (t) =>
          String(t.classId) === cid &&
          (t.assignedGroups.length === 0 ||
            t.assignedGroups.some((ag) => String(ag) === gid))
      );

      let done = 0, pending = 0, dueSoon = 0;
      for (const t of groupTasks) {
        const status = subMap.get(`${t._id}-${gid}`);
        if (status === 'submitted' || status === 'late' || status === 'reviewed') {
          done++;
        } else {
          pending++;
          if (t.deadline && t.deadline >= now && t.deadline <= weekFromNow) dueSoon++;
        }
      }

      plain.taskSummary = { total: groupTasks.length, done, pending, dueSoon };
      return plain;
    });
  },

  // Returns a single workspace with full group population.
  // Access rules: student must be a group member; instructor must have class assignment; admin always.
  async getById(id, context) {
    const workspace = await workspaceRepository.findById(id);
    if (!workspace) throw new NotFoundError('Workspace not found');

    const group   = workspace.groupId; // populated
    const classId = String(group.classId?._id ?? group.classId);

    if (context.role === 'student') {
      const studentRecord = await studentRepository.findOne({ userId: context.userId, classId });
      if (!studentRecord) throw new ForbiddenError('Access denied');
      const isMember = group.memberIds.some(
        (m) => (m._id ?? m).toString() === studentRecord._id.toString(),
      );
      if (!isMember) throw new ForbiddenError('You are not a member of this group');
    } else if (context.role === 'instructor') {
      const allowed = await courseAssignmentService.hasAccess(context.userId, classId);
      if (!allowed) throw new ForbiddenError('You do not have access to this workspace');
    }

    return workspace;
  },
};

module.exports = workspaceService;
