const Submission = require('../models/Submission');

const BASE_POPULATE = [
  { path: 'submittedBy', select: 'fullName userId', populate: { path: 'userId', select: 'studentId' } },
  { path: 'groupId',     select: 'name courseId' },
  { path: 'gradedBy',    select: 'fullName role' },
  { path: 'files',       select: 'originalName mimeType sizeBytes uploadedAt' },
];

const submissionRepository = {
  // Upsert — one submission per (taskId, groupId)
  upsert(taskId, groupId, updates) {
    return Submission.findOneAndUpdate(
      { taskId, groupId },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).populate(BASE_POPULATE);
  },

  findById(id) {
    return Submission.findById(id).populate(BASE_POPULATE);
  },

  findByTask(taskId) {
    return Submission.find({ taskId }).populate(BASE_POPULATE).sort({ submittedAt: -1, createdAt: -1 });
  },

  findOne(filter) {
    return Submission.findOne(filter).populate(BASE_POPULATE);
  },

  updateById(id, updates) {
    return Submission.findByIdAndUpdate(id, { $set: updates }, { new: true }).populate(BASE_POPULATE);
  },
};

module.exports = submissionRepository;
