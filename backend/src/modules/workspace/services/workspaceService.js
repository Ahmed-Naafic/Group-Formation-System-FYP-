const workspaceRepository = require('../repositories/workspaceRepository');

// Phase 6 stub — creates a bare workspace shell for a group.
// Chat, file, and full workspace functionality is added in Phase 7.
const workspaceService = {
  createForGroup(groupId, settings = {}) {
    return workspaceRepository.create({ groupId, settings });
  },

  findByGroupId(groupId) {
    return workspaceRepository.findByGroupId(groupId);
  },
};

module.exports = workspaceService;
