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
// Returns the offering document (used by generate/regenerate to read courseId).
async function assertCourseOfferingAccess(courseOfferingId, context) {
  return courseOfferingService.getById(courseOfferingId, context);
}

// ── Internal helpers ───────────────────────────────────────────────────────────

// Writes assembled groups to DB (Groups → Workspaces → hasBeenLeader flags → GroupHistory).
// GroupHistory is written LAST so that any earlier failure leaves history untouched;
// _rollback() covers history cleanup via deleteByGenerationId if history itself fails.
async function _persist(courseOfferingId, courseName, assembledGroups, groupSize, options, context, generationId) {
  const now            = new Date();
  const createdGroupIds = [];

  for (let i = 0; i < assembledGroups.length; i++) {
    const { members, leaderId } = assembledGroups[i];
    const group = await groupRepository.create({
      courseOfferingId,
      name:             `${courseName} Group ${i + 1}`,
      code:             `G${i + 1}`,
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

  // Write pairing history after all Group/Workspace/leader writes have succeeded.
  // If this throws, _rollback() will call deleteByGenerationId on both collections.
  await groupHistoryRepository.insertMany(
    assembledGroups.map(({ members, leaderId }) => ({
      courseOfferingId,
      generationId,
      memberIds:   members.map(m => m._id),
      leaderId,
      generatedAt: now,
      groupSize,
      options,
    }))
  );

  return Promise.all(createdGroupIds.map(id => groupRepository.findById(id)));
}

async function _rollback(generationId, archivedGroupIds) {
  const partialGroups   = await groupRepository.findByGenerationId(generationId);
  const partialGroupIds = partialGroups.map(g => g._id);

  // Delete Groups, Workspaces, and any GroupHistory written before the failure.
  await Promise.all([
    groupRepository.deleteByGenerationId(generationId),
    groupHistoryRepository.deleteByGenerationId(generationId),
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

  // Archives current active groups, then generates a fresh set.
  // History is now written by _persist() — the old-groups write here is removed.
  async regenerate(courseOfferingId, groupSize, options, context) {
    const offering = await assertCourseOfferingAccess(courseOfferingId, context);
    const courseName = offering.courseId?.name ?? 'Course';

    const currentGroups    = await groupRepository.findActiveIdsByOffering(courseOfferingId);
    const archivedGroupIds = currentGroups.map(g => g._id);

    if (currentGroups.length > 0) {
      // Old groups already have GroupHistory records from when _persist() created them.
      // Just archive them — _persist() will write history for the new generation.
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

      // A removed member's slot populates as null (softDelete excludes them
      // from the lookup) — guard against it rather than crash on `null._id`.
      const memberId = studentRecord._id.toString();
      const isMember = group.memberIds.some(m => m && (m._id ?? m).toString() === memberId);
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

    // Raw (unpopulated) fetch — a removed member populates as null on `group`
    // above, which would both crash the .map() below and, worse, permanently
    // drop that student's id from memberIds the moment this save happens.
    const raw = await groupRepository.findByIdRaw(id);
    const currentMemberIds = raw.memberIds.map(m => m.toString());
    const currentLeaderId  = raw.leaderId.toString();
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

  // Read-only history view: all past generations for a single course
  // offering, newest first. Ownership (and therefore authorization) belongs
  // to the offering — same gate generate()/regenerate() use, so an
  // instructor only ever sees history for offerings they currently teach.
  async getHistoryForOffering(courseOfferingId, context) {
    await assertCourseOfferingAccess(courseOfferingId, context);
    const records = await groupHistoryRepository.findByCourseOffering(courseOfferingId);

    // Group by generationId; Map preserves newest-first insertion order.
    const map = new Map();
    for (const rec of records) {
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

    // Mark each generation isActive if its groups are still in the active state.
    const generationIds = [...map.keys()];
    const activeGroups  = generationIds.length > 0
      ? await groupRepository.findActiveByGenerationIds(generationIds)
      : [];
    const activeGenIds = new Set(activeGroups.map(g => String(g.generationId)));

    return [...map.values()].map(gen => ({
      ...gen,
      isActive: activeGenIds.has(String(gen.generationId)),
    }));
  },
};

module.exports = groupService;
