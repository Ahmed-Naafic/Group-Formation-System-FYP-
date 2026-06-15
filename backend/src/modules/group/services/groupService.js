const mongoose               = require('mongoose');
const emitter                = require('../../../common/events/emitter');
const groupRepository        = require('../repositories/groupRepository');
const groupHistoryRepository = require('../../grouping/repositories/groupHistoryRepository');
const workspaceRepository    = require('../../workspace/repositories/workspaceRepository');
const workspaceService       = require('../../workspace/services/workspaceService');
const GroupGenerationService = require('../../grouping/services/GroupGenerationService');
const studentService         = require('../../student/services/studentService');
const studentRepository      = require('../../student/repositories/studentRepository');
const classService           = require('../../class/services/classService');
const courseService          = require('../../course/services/courseService');
const courseAssignmentService = require('../../courseAssignment/services/courseAssignmentService');
const { ForbiddenError, BadRequestError, NotFoundError, ConflictError } = require('../../../common/errors');

// ── Ownership guard ────────────────────────────────────────────────────────────

async function assertClassAccess(classId, context, courseId = null) {
  const cls = await classService.getById(String(classId));
  if (context.role === 'admin') return cls;
  const allowed = await courseAssignmentService.hasAccess(
    context.userId, String(classId), courseId ? String(courseId) : undefined,
  );
  if (!allowed) throw new ForbiddenError('You do not have access to this class');
  return cls;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// Writes assembled groups to the database (Groups → Workspaces → hasBeenLeader).
// Does NOT handle rollback — the caller wraps this in try/catch.
async function _persist(classId, courseId, courseName, assembledGroups, groupSize, options, context, generationId) {
  const now            = new Date();
  const createdGroupIds = [];

  // Step 1: Create Group documents (tagged with generationId for rollback)
  for (let i = 0; i < assembledGroups.length; i++) {
    const { members, leaderId } = assembledGroups[i];
    const group = await groupRepository.create({
      classId,
      courseId,
      name:      `${courseName} Group ${i + 1}`,
      leaderId,
      memberIds: members.map(m => m._id),
      generatedAt:      now,
      generationId,
      generationOptions: { groupSize, ...options },
      createdBy: context.userId,
    });
    createdGroupIds.push(group._id);
  }

  // Step 2: Create Workspace stubs (one per group)
  for (const groupId of createdGroupIds) {
    await workspaceService.createForGroup(groupId);
  }

  // Step 3: Mark new leaders (last — minor inaccuracy if this step fails;
  // hasBeenLeader self-corrects on the next regeneration)
  await Promise.all(assembledGroups.map(g => studentService.markAsLeader(g.leaderId)));

  return Promise.all(createdGroupIds.map(id => groupRepository.findById(id)));
}

// Compensating rollback for a failed generation.
// Removes all documents created in this run (by generationId / groupId)
// and restores any previously archived groups back to 'active'.
//
// TODO(atlas): replace this compensating rollback with a real MongoDB
// transaction when deployed on Atlas (replica set supports transactions)
async function _rollback(generationId, archivedGroupIds) {
  const partialGroups   = await groupRepository.findByGenerationId(generationId);
  const partialGroupIds = partialGroups.map(g => g._id);

  await Promise.all([
    groupRepository.deleteByGenerationId(generationId),
    ...(partialGroupIds.length > 0
      ? [workspaceRepository.deleteByGroupIds(partialGroupIds)]
      : []),
  ]);

  if (archivedGroupIds.length > 0) {
    await groupRepository.restoreByIds(archivedGroupIds);
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

const groupService = {
  // Creates groups for a class+course that has none yet.
  // Errors if active groups already exist — use regenerate to replace them.
  async generate(classId, courseId, groupSize, options, context) {
    await assertClassAccess(classId, context, courseId);
    const course = await courseService.getById(courseId);

    const existing = await groupRepository.findActiveIdsByCourse(classId, courseId);
    if (existing.length > 0) {
      throw new ConflictError(
        'This class already has active groups for this course. Use /api/groups/regenerate to replace them.',
      );
    }

    const { assembledGroups, summary } = await GroupGenerationService.generate(
      classId, courseId, groupSize, options,
    );

    const generationId = new mongoose.Types.ObjectId();
    let groups;
    try {
      groups = await _persist(classId, courseId, course.name, assembledGroups, groupSize, options, context, generationId);
    } catch (err) {
      await _rollback(generationId, []);
      throw err;
    }

    emitter.emit('groups.generated', {
      groups, courseId,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return { groups, summary };
  },

  // Archives the current active groups for this class+course (writing them to
  // history so the algorithm can avoid those pairs), then generates a fresh set.
  async regenerate(classId, courseId, groupSize, options, context) {
    await assertClassAccess(classId, context, courseId);
    const course = await courseService.getById(courseId);

    const currentGroups    = await groupRepository.findActiveIdsByCourse(classId, courseId);
    const archivedGroupIds = currentGroups.map(g => g._id);

    // Write current groups to GroupHistory BEFORE archiving so the algorithm
    // can read them and avoid repeating those pairings.
    if (currentGroups.length > 0) {
      await groupHistoryRepository.insertMany(
        currentGroups.map(g => ({
          classId,
          courseId,
          generationId:  g.generationId,
          memberIds:     g.memberIds,
          leaderId:      g.leaderId,
          generatedAt:   g.generatedAt,
          groupSize:     g.generationOptions?.groupSize ?? groupSize,
          options:       g.generationOptions ?? {},
        })),
      );
      await groupRepository.archiveByCourse(classId, courseId);
    }

    // Algorithm now reads history (which includes the just-written entries).
    const { assembledGroups, summary } = await GroupGenerationService.generate(
      classId, courseId, groupSize, options,
    );

    const generationId = new mongoose.Types.ObjectId();
    let groups;
    try {
      groups = await _persist(classId, courseId, course.name, assembledGroups, groupSize, options, context, generationId);
    } catch (err) {
      // Groups failed — clean up new artifacts and restore old groups.
      // History entries for old groups remain (accurate record) but old groups
      // are restored to active so students are not left without a group.
      await _rollback(generationId, archivedGroupIds);
      throw err;
    }

    emitter.emit('groups.generated', {
      groups, courseId,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return { groups, summary };
  },

  // Archives all active groups for a class+course in one shot.
  // Used for manual "delete all groups" — does NOT write to GroupHistory,
  // so the next generate starts with a clean slate.
  async archiveForCourse(classId, courseId, context) {
    await assertClassAccess(classId, context, courseId);
    const result = await groupRepository.archiveByCourse(classId, courseId);
    return result.modifiedCount;
  },

  // Returns active groups for a class+course.
  // Students see only the group they belong to; admin/instructor see all.
  async getByClass(classId, courseId, context) {
    if (!classId) throw new BadRequestError('classId query parameter is required');
    if (!courseId) throw new BadRequestError('courseId query parameter is required');

    if (context.role === 'student') {
      const studentRecord = await studentRepository.findOne({
        userId: context.userId, classId,
      });
      if (!studentRecord) return [];
      return groupRepository.findByCourseAndMemberId(classId, courseId, studentRecord._id);
    }

    await assertClassAccess(classId, context, courseId);
    return groupRepository.findByCourse(classId, courseId);
  },

  // Returns a single group.
  // Students may only view a group they belong to.
  async getById(id, context) {
    const group = await groupRepository.findById(id);
    if (!group) throw new NotFoundError('Group not found');

    if (context.role === 'student') {
      const studentRecord = await studentRepository.findOne({
        userId: context.userId, classId: group.classId,
      });
      if (!studentRecord) throw new ForbiddenError('You are not enrolled in this class');

      const memberId = studentRecord._id.toString();
      const isMember = group.memberIds.some(
        m => (m._id ?? m).toString() === memberId,
      );
      if (!isMember) throw new ForbiddenError('You are not a member of this group');
      return group;
    }

    await assertClassAccess(group.classId, context, group.courseId);
    return group;
  },

  // Manual adjustment: change leader, add members, remove members.
  // Body: { leaderId?, addMemberIds?, removeMemberIds? } — at least one required.
  async update(id, { leaderId, addMemberIds = [], removeMemberIds = [] }, context) {
    const group = await groupRepository.findById(id);
    if (!group) throw new NotFoundError('Group not found');
    await assertClassAccess(group.classId, context, group.courseId);

    // Work with string IDs throughout for safe comparison
    const currentMemberIds  = group.memberIds.map(m => (m._id ?? m).toString());
    const currentLeaderId   = (group.leaderId?._id ?? group.leaderId).toString();
    let newMemberIds        = [...currentMemberIds];

    // Validate and apply removals
    for (const sid of removeMemberIds) {
      if (!newMemberIds.includes(sid)) {
        throw new BadRequestError(`Student ${sid} is not a member of this group`);
      }
      newMemberIds = newMemberIds.filter(m => m !== sid);
    }

    // Must not remove the leader without simultaneously assigning a new one
    if (removeMemberIds.includes(currentLeaderId) && !leaderId) {
      throw new BadRequestError(
        'Cannot remove the current leader without assigning a new leader (provide leaderId)',
      );
    }

    // Validate and apply additions
    for (const sid of addMemberIds) {
      if (newMemberIds.includes(sid)) {
        throw new ConflictError(`Student ${sid} is already a member of this group`);
      }
      // Block if student is already in another active group for this course
      const inOther = await groupRepository.findByCourseAndMemberId(group.classId, group.courseId, sid);
      if (inOther.length > 0) {
        throw new ConflictError(
          `Student ${sid} is already in ${inOther[0].name} — remove them first`,
        );
      }
      newMemberIds.push(sid);
    }

    if (newMemberIds.length === 0) {
      throw new BadRequestError('A group must have at least one member');
    }

    // Resolve final leader
    const finalLeaderId = (leaderId ?? currentLeaderId).toString();
    if (!newMemberIds.includes(finalLeaderId)) {
      throw new BadRequestError('The assigned leader must be a member of the group');
    }

    return groupRepository.updateById(id, {
      leaderId:  finalLeaderId,
      memberIds: newMemberIds,
    });
  },
};

module.exports = groupService;
