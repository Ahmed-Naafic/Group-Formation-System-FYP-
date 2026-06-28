const Task = require('../models/Task');

// Group no longer has courseId (removed in Step 6) — populate courseOfferingId instead
const BASE_POPULATE = [
  { path: 'assignedBy',     select: 'fullName role email' },
  { path: 'assignedGroups', select: 'name courseOfferingId',
    populate: { path: 'courseOfferingId', select: 'courseId', populate: { path: 'courseId', select: 'name code' } } },
];

const taskRepository = {
  create(data) {
    return Task.create(data);
  },

  findById(id) {
    return Task.findById(id).populate(BASE_POPULATE);
  },

  findByOffering(courseOfferingId) {
    return Task.find({ courseOfferingId }).populate(BASE_POPULATE).sort({ createdAt: -1 });
  },

  // Returns tasks visible to a student: either assigned to one of their groups
  // or assigned to no specific groups (meaning all groups in the offering).
  findForStudent(courseOfferingId, groupIds) {
    return Task.find({
      courseOfferingId,
      $or: [
        { assignedGroups: { $size: 0 } },
        { assignedGroups: { $in: groupIds } },
      ],
    }).populate(BASE_POPULATE).sort({ createdAt: -1 });
  },

  closeExpiredByOffering(courseOfferingId) {
    return Task.updateMany(
      { courseOfferingId, status: 'open', deadline: { $lt: new Date() } },
      { $set: { status: 'closed' } },
    );
  },

  updateById(id, updates) {
    return Task.findByIdAndUpdate(id, { $set: updates }, { new: true }).populate(BASE_POPULATE);
  },

  softDelete(id, deletedBy) {
    return Task.findById(id).then((t) => t?.softDelete(deletedBy));
  },
};

module.exports = taskRepository;
