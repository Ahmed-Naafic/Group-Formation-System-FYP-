const Group = require('../models/Group');

// Nested populate used by every read — returns Student fields + their User's studentId/email
const STUDENT_SELECT = 'fullName attendance scores totalScore performanceCategory hasBeenLeader leaderCount userId';
const USER_SELECT    = 'studentId email';

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

  findByClass(classId) {
    return withMembers(Group.find({ classId, status: 'active' })).sort({ name: 1 });
  },

  // Used by student-role access: returns only groups containing this student.
  findByClassAndMemberId(classId, studentId) {
    return withMembers(Group.find({ classId, status: 'active', memberIds: studentId })).sort({ name: 1 });
  },

  // Returns only _id fields — used to capture IDs before archiving (for rollback).
  findActiveIdsByClass(classId) {
    return Group.find({ classId, status: 'active' }, '_id generationId memberIds leaderId generatedAt generationOptions').lean();
  },

  // Used by rollback to identify partially created documents.
  findByGenerationId(generationId) {
    return Group.find({ generationId }, '_id').lean();
  },

  archiveByClass(classId) {
    return Group.updateMany({ classId, status: 'active' }, { $set: { status: 'archived' } });
  },

  restoreByIds(ids) {
    return Group.updateMany({ _id: { $in: ids } }, { $set: { status: 'active' } });
  },

  updateById(id, updates) {
    return withMembers(Group.findByIdAndUpdate(id, { $set: updates }, { new: true }));
  },

  deleteByGenerationId(generationId) {
    return Group.deleteMany({ generationId });
  },
};

module.exports = groupRepository;
