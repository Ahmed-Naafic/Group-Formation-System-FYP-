const Feedback = require('../models/Feedback');

const BASE_POPULATE = [
  { path: 'fromUserId', select: 'fullName role' },
  { path: 'toUserId',   select: 'fullName role' },
  { path: 'groupId',    select: 'name' },
  { path: 'taskId',     select: 'title' },
];

const feedbackRepository = {
  create(data) {
    return Feedback.create(data);
  },

  findByGroup(groupId, taskId = null) {
    const filter = { groupId };
    if (taskId) filter.taskId = taskId;
    return Feedback.find(filter).populate(BASE_POPULATE).sort({ createdAt: -1 });
  },

  findByUser(fromUserId) {
    return Feedback.find({ fromUserId }).populate(BASE_POPULATE).sort({ createdAt: -1 });
  },
};

module.exports = feedbackRepository;
