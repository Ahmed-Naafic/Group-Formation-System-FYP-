const Group = require('../models/Group');

// Nested populate used by every read — returns Student fields + their User's studentId/email
const STUDENT_SELECT = 'fullName averageScore attendance performanceCategory hasBeenLeader leaderCount userId';
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

  findByCourse(classId, courseId) {
    return withMembers(Group.find({ classId, courseId, status: 'active' })).sort({ name: 1 });
  },

  // Used by student-role access: returns only groups containing this student.
  findByCourseAndMemberId(classId, courseId, studentId) {
    return withMembers(Group.find({ classId, courseId, status: 'active', memberIds: studentId })).sort({ name: 1 });
  },

  // Returns only _id fields — used to capture IDs before archiving (for rollback).
  findActiveIdsByCourse(classId, courseId) {
    return Group.find({ classId, courseId, status: 'active' }, '_id generationId memberIds leaderId generatedAt generationOptions').lean();
  },

  // Used by rollback to identify partially created documents.
  findByGenerationId(generationId) {
    return Group.find({ generationId }, '_id').lean();
  },

  archiveByCourse(classId, courseId) {
    return Group.updateMany({ classId, courseId, status: 'active' }, { $set: { status: 'archived' } });
  },

  restoreByIds(ids) {
    return Group.updateMany({ _id: { $in: ids } }, { $set: { status: 'active' } });
  },

  updateById(id, updates) {
    return withMembers(Group.findByIdAndUpdate(id, { $set: updates }, { new: true }));
  },

  // Returns active group IDs for all groups a student belongs to (cross-class/course).
  findByMemberIds(studentIds) {
    return Group.find({ status: 'active', memberIds: { $in: studentIds } }, '_id').lean();
  },

  deleteByGenerationId(generationId) {
    return Group.deleteMany({ generationId });
  },

  countActiveByClass(classId) {
    return Group.countDocuments({ classId, status: 'active' });
  },

  // Used by CourseOffering cascade-delete guard.
  // Returns 0 until Step 6 adds courseOfferingId to Group documents.
  countActiveByOffering(courseOfferingId) {
    return Group.countDocuments({ courseOfferingId, status: 'active' });
  },
};

module.exports = groupRepository;
