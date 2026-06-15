const workspaceRepository      = require('../repositories/workspaceRepository');
const groupRepository          = require('../../group/repositories/groupRepository');
const studentRepository        = require('../../student/repositories/studentRepository');
const courseOfferingService    = require('../../courseOffering/services/courseOfferingService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const Task                     = require('../../task/models/Task');
const Submission               = require('../../submission/models/Submission');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

const workspaceService = {
  // Called by groupService._persist — creates a bare workspace shell for each new group.
  createForGroup(groupId, settings = {}) {
    return workspaceRepository.create({ groupId, settings });
  },

  // Returns all workspaces for groups the logged-in student belongs to,
  // each enriched with a taskSummary.
  // NOTE: task lookup uses courseOfferingId — returns 0 until Step 7 migrates Task model.
  async findForStudent(userId) {
    const studentRecords = await studentRepository.findAll({ userId, deletedAt: null });
    if (!studentRecords.length) return [];

    const studentIds = studentRecords.map(s => s._id);
    const groups     = await groupRepository.findByMemberIds(studentIds);
    if (!groups.length) return [];

    const workspaces = await workspaceRepository.findByGroupIds(groups.map(g => g._id));
    if (!workspaces.length) return [];

    const offeringIds = [
      ...new Set(
        workspaces.map(ws => String(ws.groupId?.courseOfferingId?._id ?? ws.groupId?.courseOfferingId))
      ),
    ].filter(Boolean);
    const groupIds = workspaces.map(ws => ws.groupId._id);

    // Task.courseOfferingId does not exist until Step 7 — query will return 0 results until then.
    const [tasks, submissions] = await Promise.all([
      Task.find({ courseOfferingId: { $in: offeringIds }, deletedAt: null })
        .select('_id courseOfferingId assignedGroups deadline')
        .lean(),
      Submission.find({ groupId: { $in: groupIds }, deletedAt: null })
        .select('taskId groupId status')
        .lean(),
    ]);

    const subMap = new Map(submissions.map(s => [`${s.taskId}-${s.groupId}`, s.status]));

    const now         = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return workspaces.map(ws => {
      const plain   = ws.toObject();
      const group   = ws.groupId;
      const gid     = String(group._id);
      const oid     = String(group.courseOfferingId?._id ?? group.courseOfferingId);

      const groupTasks = tasks.filter(
        t =>
          String(t.courseOfferingId) === oid &&
          (t.assignedGroups.length === 0 ||
            t.assignedGroups.some(ag => String(ag) === gid)),
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

  // Returns a single workspace. Access rules:
  // student must be a group member; instructor must own the offering; admin always.
  async getById(id, context) {
    const workspace = await workspaceRepository.findById(id);
    if (!workspace) throw new NotFoundError('Workspace not found');

    const group      = workspace.groupId;
    const offeringId = String(group.courseOfferingId?._id ?? group.courseOfferingId);

    if (context.role === 'student') {
      const offering = await courseOfferingRepository.findById(offeringId);
      if (!offering) throw new ForbiddenError('Access denied');
      const cohortId = String(offering.cohortId?._id ?? offering.cohortId);
      const studentRecord = await studentRepository.findOne({ userId: context.userId, cohortId, deletedAt: null });
      if (!studentRecord) throw new ForbiddenError('Access denied');
      const isMember = group.memberIds.some(
        m => (m._id ?? m).toString() === studentRecord._id.toString(),
      );
      if (!isMember) throw new ForbiddenError('You are not a member of this group');
    } else if (context.role === 'instructor') {
      // courseOfferingService.getById enforces instructor-owns-offering access
      await courseOfferingService.getById(offeringId, context);
    }

    return workspace;
  },
};

module.exports = workspaceService;
