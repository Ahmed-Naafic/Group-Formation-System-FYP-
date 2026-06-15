const Workspace = require('../models/Workspace');

const GROUP_POPULATE = {
  path: 'groupId',
  populate: [
    {
      path: 'courseOfferingId',
      populate: [
        { path: 'courseId',   select: 'name code' },
        { path: 'cohortId',   select: 'name' },
        { path: 'semesterId', select: 'name' },
      ],
    },
    {
      path: 'leaderId',
      select: 'fullName performanceCategory userId',
      populate: { path: 'userId', select: 'studentId' },
    },
    {
      path: 'memberIds',
      select: 'fullName performanceCategory userId',
      populate: { path: 'userId', select: 'studentId' },
    },
  ],
};

const workspaceRepository = {
  create(data) {
    return Workspace.create(data);
  },

  findById(id) {
    return Workspace.findById(id).populate(GROUP_POPULATE);
  },

  findByGroupId(groupId) {
    return Workspace.findOne({ groupId }).populate(GROUP_POPULATE);
  },

  findByGroupIds(groupIds) {
    return Workspace.find({ groupId: { $in: groupIds } }).populate(GROUP_POPULATE);
  },

  deleteByGroupIds(groupIds) {
    return Workspace.deleteMany({ groupId: { $in: groupIds } });
  },
};

module.exports = workspaceRepository;
