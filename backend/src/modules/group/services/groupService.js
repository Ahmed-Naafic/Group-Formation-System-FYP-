const mongoose               = require('mongoose');
const emitter                = require('../../../common/events/emitter');
const groupRepository        = require('../repositories/groupRepository');
const groupHistoryRepository = require('../../grouping/repositories/groupHistoryRepository');
const workspaceRepository    = require('../../workspace/repositories/workspaceRepository');
const workspaceService       = require('../../workspace/services/workspaceService');
const GroupGenerationService = require('../../grouping/services/GroupGenerationService');
const studentService         = require('../../student/services/studentService');
const studentRepository      = require('../../student/repositories/studentRepository');
const courseOfferingService  = require('../../courseOffering/services/courseOfferingService');
const courseOfferingRepository = require('../../courseOffering/repositories/courseOfferingRepository');
const { ForbiddenError, BadRequestError, NotFoundError, ConflictError } = require('../../../common/errors');

// Resolves the offering and enforces ownership: instructor sees only their own offering.
// Returns the offering document (used by generate/regenerate to read cohortId/courseId).
async function assertCourseOfferingAccess(courseOfferingId, context) {
  return courseOfferingService.getById(courseOfferingId, context);
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// Writes assembled groups to DB (Groups → Workspaces → hasBeenLeader flags).
async function _persist(courseOfferingId, courseName, assembledGroups, groupSize, options, context, generationId) {
  const now            = new Date();
  const createdGroupIds = [];

  for (let i = 0; i < assembledGroups.length; i++) {
    const { members, leaderId } = assembledGroups[i];
    const group = await groupRepository.create({
      courseOfferingId,
      name:             `${courseName} Group ${i + 1}`,
      leaderId,
      memberIds:        members.map(m => m._id),
      generatedAt:      now,
      generationId,
      generationOptions: { groupSize, ...options },
      createdBy:        context.userId,
    });
    createdGroupIds.push(group._id);
  }

  for (const groupId of createdGroupIds) {
    await workspaceService.createForGroup(groupId);
  }

  await Promise.all(assembledGroups.map(g => studentService.markAsLeader(g.leaderId)));

  return Promise.all(createdGroupIds.map(id => groupRepository.findById(id)));
}

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
  // Creates groups for a course offering that has none yet.
  async generate(courseOfferingId, groupSize, options, context) {
    const offering = await assertCourseOfferingAccess(courseOfferingId, context);
    const cohortId = String(offering.cohortId?._id ?? offering.cohortId);

    // Course name comes via offering.courseId (populated in getById)
    const courseName = offering.courseId?.name ?? 'Course';

    const existing = await groupRepository.findActiveIdsByOffering(courseOfferingId);
    if (existing.length > 0) {
      throw new ConflictError(
        'This offering already has active groups. Use /api/groups/regenerate to replace them.',
      );
    }

    const { assembledGroups, summary } = await GroupGenerationService.generate(
      courseOfferingId, groupSize, options,
    );

    const generationId = new mongoose.Types.ObjectId();
    let groups;
    try {
      groups = await _persist(courseOfferingId, courseName, assembledGroups, groupSize, options, context, generationId);
    } catch (err) {
      await _rollback(generationId, []);
      throw err;
    }

    emitter.emit('groups.generated', {
      groups, courseOfferingId,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return { groups, summary };
  },

  // Archives current active groups (writing to history for pair-avoidance), then generates fresh set.
  async regenerate(courseOfferingId, groupSize, options, context) {
    const offering = await assertCourseOfferingAccess(courseOfferingId, context);
    const cohortId  = String(offering.cohortId?._id ?? offering.cohortId);
    const courseName = offering.courseId?.name ?? 'Course';

    const currentGroups    = await groupRepository.findActiveIdsByOffering(courseOfferingId);
    const archivedGroupIds = currentGroups.map(g => g._id);

    if (currentGroups.length > 0) {
      // Write current groups to history so pair-avoidance can read them.
      await groupHistoryRepository.insertMany(
        currentGroups.map(g => ({
          courseOfferingId,
          cohortId,
          generationId:  g.generationId,
          memberIds:     g.memberIds,
          leaderId:      g.leaderId,
          generatedAt:   g.generatedAt,
          groupSize:     g.generationOptions?.groupSize ?? groupSize,
          options:       g.generationOptions ?? {},
        })),
      );
      await groupRepository.archiveByOffering(courseOfferingId);
    }

    const { assembledGroups, summary } = await GroupGenerationService.generate(
      courseOfferingId, groupSize, options,
    );

    const generationId = new mongoose.Types.ObjectId();
    let groups;
    try {
      groups = await _persist(courseOfferingId, courseName, assembledGroups, groupSize, options, context, generationId);
    } catch (err) {
      await _rollback(generationId, archivedGroupIds);
      throw err;
    }

    emitter.emit('groups.generated', {
      groups, courseOfferingId,
      actorId: context.userId, actorRole: context.role,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    });

    return { groups, summary };
  },

  // Archives all active groups for an offering (manual delete-all, no history written).
  async archiveForOffering(courseOfferingId, context) {
    await assertCourseOfferingAccess(courseOfferingId, context);
    const result = await groupRepository.archiveByOffering(courseOfferingId);
    return result.modifiedCount;
  },

  // Returns active groups for an offering.
  // Students see only the group they belong to; admin/instructor see all.
  async getByOffering(courseOfferingId, context) {
    if (!courseOfferingId) throw new BadRequestError('courseOfferingId query parameter is required');

    if (context.role === 'student') {
      // Derive cohortId from offering to look up the student record.
      const offering = await courseOfferingRepository.findById(courseOfferingId);
      if (!offering) return [];
      const cohortId = String(offering.cohortId?._id ?? offering.cohortId);
      const studentRecord = await studentRepository.findOne({ userId: context.userId, cohortId, deletedAt: null });
      if (!studentRecord) return [];
      return groupRepository.findByOfferingAndMemberId(courseOfferingId, studentRecord._id);
    }

    await assertCourseOfferingAccess(courseOfferingId, context);
    return groupRepository.findByCourseOffering(courseOfferingId);
  },

  // Returns a single group.
  async getById(id, context) {
    const group = await groupRepository.findById(id);
    if (!group) throw new NotFoundError('Group not found');

    if (context.role === 'student') {
      const offeringId = String(group.courseOfferingId?._id ?? group.courseOfferingId);
      const offering   = await courseOfferingRepository.findById(offeringId);
      if (!offering) throw new ForbiddenError('Course offering not found');
      const cohortId  = String(offering.cohortId?._id ?? offering.cohortId);
      const studentRecord = await studentRepository.findOne({ userId: context.userId, cohortId, deletedAt: null });
      if (!studentRecord) throw new ForbiddenError('You are not enrolled in this cohort');

      const memberId = studentRecord._id.toString();
      const isMember = group.memberIds.some(m => (m._id ?? m).toString() === memberId);
      if (!isMember) throw new ForbiddenError('You are not a member of this group');
      return group;
    }

    await assertCourseOfferingAccess(String(group.courseOfferingId?._id ?? group.courseOfferingId), context);
    return group;
  },

  // Manual adjustment: change leader, add/remove members.
  async update(id, { leaderId, addMemberIds = [], removeMemberIds = [] }, context) {
    const group = await groupRepository.findById(id);
    if (!group) throw new NotFoundError('Group not found');

    const offeringId = String(group.courseOfferingId?._id ?? group.courseOfferingId);
    await assertCourseOfferingAccess(offeringId, context);

    const currentMemberIds = group.memberIds.map(m => (m._id ?? m).toString());
    const currentLeaderId  = (group.leaderId?._id ?? group.leaderId).toString();
    let newMemberIds       = [...currentMemberIds];

    for (const sid of removeMemberIds) {
      if (!newMemberIds.includes(sid)) {
        throw new BadRequestError(`Student ${sid} is not a member of this group`);
      }
      newMemberIds = newMemberIds.filter(m => m !== sid);
    }

    if (removeMemberIds.includes(currentLeaderId) && !leaderId) {
      throw new BadRequestError(
        'Cannot remove the current leader without assigning a new leader (provide leaderId)',
      );
    }

    for (const sid of addMemberIds) {
      if (newMemberIds.includes(sid)) {
        throw new ConflictError(`Student ${sid} is already a member of this group`);
      }
      const inOther = await groupRepository.findByOfferingAndMemberId(offeringId, sid);
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

    const finalLeaderId = (leaderId ?? currentLeaderId).toString();
    if (!newMemberIds.includes(finalLeaderId)) {
      throw new BadRequestError('The assigned leader must be a member of the group');
    }

    return groupRepository.updateById(id, { leaderId: finalLeaderId, memberIds: newMemberIds });
  },

  // Read-only history view: all past generations for a cohort, newest first.
  // Instructor-scoped to offerings they own; admin sees all.
  async getHistory(cohortId, context) {
    const records = await groupHistoryRepository.findByCohortPopulated(cohortId);

    const filtered = context.role === 'instructor'
      ? records.filter(r => {
          const instrId = String(r.courseOfferingId?.instructorId ?? '');
          return instrId === context.userId;
        })
      : records;

    // Group by generationId; Map preserves newest-first insertion order.
    const map = new Map();
    for (const rec of filtered) {
      const gid = String(rec.generationId);
      if (!map.has(gid)) {
        map.set(gid, {
          generationId:   rec.generationId,
          courseOffering: rec.courseOfferingId,
          generatedAt:    rec.generatedAt,
          groupSize:      rec.groupSize,
          groups:         [],
        });
      }
      map.get(gid).groups.push({
        memberIds: rec.memberIds,
        leaderId:  rec.leaderId,
      });
    }

    return [...map.values()];
  },
};

module.exports = groupService;
