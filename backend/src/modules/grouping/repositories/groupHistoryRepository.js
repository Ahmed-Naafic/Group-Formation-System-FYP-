const GroupHistory = require('../models/GroupHistory');

const groupHistoryRepository = {
  create(data) {
    return GroupHistory.create(data);
  },

  insertMany(docs) {
    return GroupHistory.insertMany(docs);
  },

  // Cross-offering pair-avoidance query scope — the caller resolves which
  // offering IDs belong to a cohort (courseOfferingRepository.findByCohort)
  // and passes them here. We avoid re-pairing students who shared a group in
  // ANY previous offering for that cohort (Q3 design decision) — ownership of
  // each record is still per-offering, this is just how the algorithm reads
  // across all of them.
  findByCourseOfferingIds(courseOfferingIds) {
    return GroupHistory.find({ courseOfferingId: { $in: courseOfferingIds } }).sort({ generatedAt: -1 });
  },

  // Populated version used by the read-only, offering-scoped history view.
  findByCourseOffering(courseOfferingId) {
    return GroupHistory.find({ courseOfferingId })
      .populate({
        path: 'courseOfferingId',
        select: 'courseId semesterId',
        populate: [
          { path: 'courseId',   select: 'name code' },
          { path: 'semesterId', select: 'name' },
        ],
      })
      .populate({
        path:     'memberIds',
        select:   'fullName performanceCategory userId',
        populate: { path: 'userId', select: 'studentId' },
      })
      .populate({ path: 'leaderId', select: '_id' })
      .sort({ generatedAt: -1 })
      .lean();
  },

  deleteByGenerationId(generationId) {
    return GroupHistory.deleteMany({ generationId });
  },

  // Used by studentService.permanentDelete — true if this student appears
  // anywhere in group-formation history (as a member or as the leader),
  // even for offerings/generations with no currently-active Group.
  existsWithStudent(studentId) {
    return GroupHistory.exists({ $or: [{ memberIds: studentId }, { leaderId: studentId }] });
  },
};

module.exports = groupHistoryRepository;
