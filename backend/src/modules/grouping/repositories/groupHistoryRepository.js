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

  deleteByGenerationId(generationId) {
    return GroupHistory.deleteMany({ generationId });
  },
};

module.exports = groupHistoryRepository;
