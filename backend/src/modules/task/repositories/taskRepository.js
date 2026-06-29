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

  // Returns open tasks whose deadline falls within the next `hours` hours
  // and haven't had a reminder sent yet.
  findDueForReminder(hours = 24) {
    const now  = new Date();
    const soon = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return Task.find({
      status:         'open',
      deadline:       { $gte: now, $lte: soon },
      reminderSentAt: null,
      deletedAt:      null,
    }).populate({
      path:     'assignedGroups',
      select:   'name memberIds',
      populate: { path: 'memberIds', select: 'userId' },
    });
  },

  markReminderSent(id) {
    return Task.findByIdAndUpdate(id, { reminderSentAt: new Date() });
  },
};

module.exports = taskRepository;
