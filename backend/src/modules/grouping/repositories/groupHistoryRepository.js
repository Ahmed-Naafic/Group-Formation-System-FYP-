const GroupHistory = require('../models/GroupHistory');

const groupHistoryRepository = {
  create(data) {
    return GroupHistory.create(data);
  },

  insertMany(docs) {
    return GroupHistory.insertMany(docs);
  },

  findByCourse(classId, courseId) {
    return GroupHistory.find({ classId, courseId }).sort({ generatedAt: -1 });
  },

  deleteByGenerationId(generationId) {
    return GroupHistory.deleteMany({ generationId });
  },
};

module.exports = groupHistoryRepository;
