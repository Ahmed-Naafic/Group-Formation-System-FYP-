const workspaceRepository      = require('../repositories/workspaceRepository');
const groupRepository          = require('../../group/repositories/groupRepository');
const studentRepository        = require('../../student/repositories/studentRepository');
const courseOfferingService    = require('../../courseOffering/services/courseOfferingService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const Workspace                 = require('../models/Workspace');
const Group                     = require('../../group/models/Group');
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
        .select('_id courseOfferingId assignedGroups deadline title submissionType')
        .lean(),
      Submission.find({ groupId: { $in: groupIds }, deletedAt: null })
        .select('taskId groupId status grade gradedAt submittedBy')
        .lean(),
    ]);

    // Grouped by task+group rather than a single value per key — individual-mode
    // tasks can have several submissions (one per member) sharing the same
    // group, so picking "my" one needs the full list, not just the last write.
    const subsByTaskAndGroup = new Map();
    for (const s of submissions) {
      const key = `${s.taskId}-${s.groupId}`;
      if (!subsByTaskAndGroup.has(key)) subsByTaskAndGroup.set(key, []);
      subsByTaskAndGroup.get(key).push(s);
    }

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
      const taskList = [];
      for (const t of groupTasks) {
        const candidates = subsByTaskAndGroup.get(`${t._id}-${gid}`) ?? [];
        // Individual-mode: only *this* student's own submission counts — a
        // groupmate submitting doesn't grade or complete it for anyone else.
        // Group-mode: any member's submission represents the whole group.
        const mySubmission = t.submissionType === 'individual'
          ? candidates.find(s => studentIds.some(sid => String(sid) === String(s.submittedBy)))
          : candidates[0];

        const status = mySubmission?.status;
        if (status === 'submitted' || status === 'late' || status === 'reviewed') {
          done++;
        } else {
          pending++;
          if (t.deadline && t.deadline >= now && t.deadline <= weekFromNow) dueSoon++;
        }

        taskList.push({
          taskId:         t._id,
          title:          t.title,
          submissionType: t.submissionType,
          deadline:       t.deadline,
          status:         status ?? null,
          grade:          mySubmission?.grade ?? null,
          gradedAt:       mySubmission?.gradedAt ?? null,
        });
      }

      plain.taskSummary = { total: groupTasks.length, done, pending, dueSoon };
      plain.tasks = taskList;
      return plain;
    });
  },

  // Looks up a workspace by its group's _id rather than by workspace _id.
  // Used by the instructor "Open Workspace" flow where only the group id is known.
  // Same access rules as getById — delegated to courseOfferingService.getById for instructors.
  async getByGroupId(groupId, context) {
    const workspace = await workspaceRepository.findByGroupId(groupId);
    if (!workspace) throw new NotFoundError('Workspace not found for this group');

    const group      = workspace.groupId;
    const offeringId = String(group.courseOfferingId?._id ?? group.courseOfferingId);

    if (context.role === 'student') {
      const offering = await courseOfferingRepository.findById(offeringId);
      if (!offering) throw new ForbiddenError('Access denied');
      const cohortId      = String(offering.cohortId?._id ?? offering.cohortId);
      const studentRecord = await studentRepository.findOne({ userId: context.userId, cohortId, deletedAt: null });
      if (!studentRecord) throw new ForbiddenError('Access denied');
      const isMember = group.memberIds.some(
        m => (m._id ?? m).toString() === studentRecord._id.toString(),
      );
      if (!isMember) throw new ForbiddenError('You are not a member of this group');
    } else if (context.role === 'instructor') {
      await courseOfferingService.getById(offeringId, context);
    }

    return workspace;
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

  // Same access decision as getById (admin: always; instructor: owns the
  // offering; student: is a group member) but WITHOUT the deep
  // group→courseOffering→course/cohort/semester/members populate — getById
  // was built for the workspace detail page, which actually needs all of
  // that. Hot paths that only need a yes/no (every chat operation) should
  // use this instead; it resolves the same decision in far fewer round
  // trips. Throws, never returns a value — call sites just await it.
  async assertMembership(workspaceId, context) {
    if (context.role === 'admin') {
      const exists = await Workspace.exists({ _id: workspaceId });
      if (!exists) throw new NotFoundError('Workspace not found');
      return;
    }

    const workspace = await Workspace.findById(workspaceId).select('groupId').lean();
    if (!workspace) throw new NotFoundError('Workspace not found');

    if (context.role === 'instructor') {
      const group = await Group.findById(workspace.groupId).select('courseOfferingId').lean();
      if (!group) throw new NotFoundError('Workspace not found');
      // courseOfferingService.getById enforces instructor-owns-offering access
      await courseOfferingService.getById(String(group.courseOfferingId), context);
      return;
    }

    // student
    const group = await Group.findById(workspace.groupId).select('memberIds').lean();
    if (!group) throw new NotFoundError('Workspace not found');

    const studentRecords = await studentRepository.findAll({ userId: context.userId, deletedAt: null });
    const studentIds     = new Set(studentRecords.map(s => String(s._id)));
    const isMember        = group.memberIds.some(m => studentIds.has(String(m)));
    if (!isMember) throw new ForbiddenError('You are not a member of this group');
  },
};

module.exports = workspaceService;
