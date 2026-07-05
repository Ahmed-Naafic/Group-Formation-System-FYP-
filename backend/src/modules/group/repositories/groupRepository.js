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
};

module.exports = groupRepository;
