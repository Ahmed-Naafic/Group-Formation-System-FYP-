const File = require('../models/File');

const UPLOADER_POPULATE = { path: 'uploadedBy', select: 'fullName role' };

const fileRepository = {
  create(data) {
    return File.create(data);
  },

  findByWorkspace(workspaceId) {
    return File.find({ workspaceId }).sort({ uploadedAt: -1 }).populate(UPLOADER_POPULATE).lean();
  },

  findById(id) {
    return File.findById(id).populate(UPLOADER_POPULATE);
  },

  softDelete(id, deletedBy) {
    return File.findById(id).then((f) => f?.softDelete(deletedBy));
  },
};

module.exports = fileRepository;
