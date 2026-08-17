const Group = require('../models/Group');

// attendance removed from Student in Step 5 — no longer populated
const STUDENT_SELECT = 'fullName averageScore performanceCategory hasBeenLeader leaderCount userId';
const USER_SELECT    = 'studentId email avatarUrl';

function withMembers(query) {
  return query
    .populate({ path: 'leaderId',  select: STUDENT_SELECT, populate: { path: 'userId', select: USER_SELECT } })
    .populate({ path: 'memberIds', select: STUDENT_SELECT, populate: { path: 'userId', select: USER_SELECT } });
}

const groupRepository = {
  create(data) {
    return Group.create(data);
  },

  findById(id) {
    return withMembers(Group.findById(id));
  },

  // Unpopulated — memberIds/leaderId stay as raw ObjectIds even when a
  // referenced Student has been soft-deleted (populate() would otherwise
  // silently turn that array slot into null, losing the id). Used wherever
  // code needs to reliably diff/preserve the actual membership list.
  findByIdRaw(id) {
    return Group.findById(id);
  },

  // Lightweight — used by AI variation generation and bulk task creation,
  // which only need identity/name/offering, not full member rosters.
  findByIds(ids) {
    return Group.find({ _id: { $in: ids } }, '_id name courseOfferingId');
  },

  findByCourseOffering(courseOfferingId) {
    return withMembers(Group.find({ courseOfferingId, status: 'active' })).sort({ name: 1 });
  },

  findByOfferingAndMemberId(courseOfferingId, studentId) {
    return withMembers(Group.find({ courseOfferingId, status: 'active', memberIds: studentId })).sort({ name: 1 });
  },

  // Returns lean docs — used to capture state before archiving (rollback/history).
  findActiveIdsByOffering(courseOfferingId) {
    return Group.find(
      { courseOfferingId, status: 'active' },
      '_id generationId memberIds leaderId generatedAt generationOptions',
    ).lean();
  },

  findByGenerationId(generationId) {
    return Group.find({ generationId }, '_id').lean();
  },

  archiveByOffering(courseOfferingId) {
    return Group.updateMany({ courseOfferingId, status: 'active' }, { $set: { status: 'archived' } });
  },

  restoreByIds(ids) {
    return Group.updateMany({ _id: { $in: ids } }, { $set: { status: 'active' } });
  },

  updateById(id, updates) {
    return withMembers(Group.findByIdAndUpdate(id, { $set: updates }, { new: true }));
  },

  findByMemberIds(studentIds) {
    return Group.find({ status: 'active', memberIds: { $in: studentIds } }, '_id').lean();
  },

  // Used by getHistory() to determine which generationIds still have active groups.
  findActiveByGenerationIds(generationIds) {
    return Group.find({ generationId: { $in: generationIds }, status: 'active' }, 'generationId').lean();
  },

  deleteByGenerationId(generationId) {
    return Group.deleteMany({ generationId });
  },

  // Cascade-delete guard used by CourseOffering softDelete.
  countActiveByOffering(courseOfferingId) {
    return Group.countDocuments({ courseOfferingId, status: 'active' });
  },

  // Returns active groups with memberIds populated (userId only) — used by deadline reminder job.
  findActiveByOffering(courseOfferingId) {
    return Group.find({ courseOfferingId, status: 'active' }, 'memberIds')
      .populate({ path: 'memberIds', select: 'userId' });
  },

  // Used by studentService.permanentDelete — true if this student appears in
  // ANY group (active, archived, or soft-deleted) as a member or as the
  // leader. includeSoftDeleted() is defensive: nothing soft-deletes a Group
  // today, but a permanent-delete guard should not silently miss one if that
  // ever changes.
  async existsWithMember(studentId) {
    const found = await Group.exists({ $or: [{ memberIds: studentId }, { leaderId: studentId }] })
      .includeSoftDeleted();
    return !!found;
  },

  // Used by studentService.transfer — true only if this student is a member
  // or leader of a CURRENTLY ACTIVE group (unlike existsWithMember, archived
  // groups don't count). An active group is a live, in-progress academic
  // construct in one specific cohort's offering; transferring its member out
  // from under it would leave a dangling reference, so transfer blocks on
  // this and asks the admin to resolve it on the Groups page first — it does
  // not silently mutate someone else's live group.
  async existsInActiveGroup(studentId) {
    const found = await Group.exists({ status: 'active', $or: [{ memberIds: studentId }, { leaderId: studentId }] })
      .includeSoftDeleted();
    return !!found;
  },
};

module.exports = groupRepository;
