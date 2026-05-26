const Task = require('../models/Task');

const BASE_POPULATE = [
  { path: 'assignedBy',     select: 'fullName role email' },
  { path: 'assignedGroups', select: 'name courseId', populate: { path: 'courseId', select: 'name code' } },
];

const taskRepository = {
  create(data) {
    return Task.create(data);
  },

  findById(id) {
    return Task.findById(id).populate(BASE_POPULATE);
  },

  findByClass(classId) {
    return Task.find({ classId }).populate(BASE_POPULATE).sort({ createdAt: -1 });
  },

  // Returns tasks that have at least one group from the given groupIds list
  findByGroupIds(groupIds) {
    return Task.find({ assignedGroups: { $in: groupIds } })
      .populate(BASE_POPULATE)
      .sort({ createdAt: -1 });
  },

  updateById(id, updates) {
    return Task.findByIdAndUpdate(id, { $set: updates }, { new: true }).populate(BASE_POPULATE);
  },

  softDelete(id, deletedBy) {
    return Task.findById(id).then((t) => t?.softDelete(deletedBy));
  },
};

module.exports = taskRepository;
