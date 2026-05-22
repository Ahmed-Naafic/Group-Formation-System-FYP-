const Workspace = require('../models/Workspace');

const workspaceRepository = {
  create(data) {
    return Workspace.create(data);
  },

  findByGroupId(groupId) {
    return Workspace.findOne({ groupId });
  },

  findByGroupIds(groupIds) {
    return Workspace.find({ groupId: { $in: groupIds } });
  },

  deleteByGroupIds(groupIds) {
    return Workspace.deleteMany({ groupId: { $in: groupIds } });
  },
};

module.exports = workspaceRepository;
