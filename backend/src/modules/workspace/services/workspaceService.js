const workspaceRepository    = require('../repositories/workspaceRepository');
const groupRepository        = require('../../group/repositories/groupRepository');
const studentRepository      = require('../../student/repositories/studentRepository');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

const workspaceService = {
  // Called by groupService._persist — creates a bare workspace shell for each new group.
  createForGroup(groupId, settings = {}) {
    return workspaceRepository.create({ groupId, settings });
  },

  // Returns all workspaces for groups the logged-in student belongs to.
  async findForStudent(userId) {
    const studentRecords = await studentRepository.findAll({ userId });
    if (!studentRecords.length) return [];

    const studentIds = studentRecords.map((s) => s._id);
    const groups     = await groupRepository.findByMemberIds(studentIds);
    if (!groups.length) return [];

    return workspaceRepository.findByGroupIds(groups.map((g) => g._id));
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
