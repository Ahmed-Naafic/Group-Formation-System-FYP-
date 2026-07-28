const GroupHistory = require('../models/GroupHistory');

const groupHistoryRepository = {
  create(data) {
    return GroupHistory.create(data);
  },

  insertMany(docs) {
    return GroupHistory.insertMany(docs);
  },

  // Reads ALL prior group history for a cohort across every offering.
  // This is the pair-avoidance query: we avoid re-pairing students who shared
  // a group in ANY previous offering for this cohort (Q3 design decision).
  findByCohort(cohortId) {
    return GroupHistory.find({ cohortId }).sort({ generatedAt: -1 });
  },

  // Populated version used by the read-only history view.
  findByCohortPopulated(cohortId) {
    return GroupHistory.find({ cohortId })
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
};

module.exports = groupHistoryRepository;
