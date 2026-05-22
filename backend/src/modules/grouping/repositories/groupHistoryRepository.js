const GroupHistory = require('../models/GroupHistory');

const groupHistoryRepository = {
  create(data) {
    return GroupHistory.create(data);
  },

  insertMany(docs) {
    return GroupHistory.insertMany(docs);
  },

  findByClass(classId) {
    return GroupHistory.find({ classId }).sort({ generatedAt: -1 });
  },

  deleteByGenerationId(generationId) {
    return GroupHistory.deleteMany({ generationId });
  },
};

module.exports = groupHistoryRepository;
