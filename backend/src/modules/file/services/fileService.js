const fileRepository    = require('../repositories/fileRepository');
const workspaceService  = require('../../workspace/services/workspaceService');
const StorageService    = require('../../../common/services/storage/StorageService');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');

const fileService = {
  /**
   * Lists all (non-deleted) files attached to a workspace.
   */
  async list(workspaceId, context) {
    await workspaceService.getById(workspaceId, context);
    return fileRepository.findByWorkspace(workspaceId);
  },

  /**
   * Saves the uploaded buffer to disk and creates a File document.
   * `multerFile` is the object provided by multer's memoryStorage:
   *   { originalname, mimetype, size, buffer }
   */
  async upload(workspaceId, multerFile, context) {
    await workspaceService.getById(workspaceId, context);

    const folder     = `workspaces/${workspaceId}`;
    const storageKey = await StorageService.save(
      multerFile.buffer,
      multerFile.originalname,
      folder,
    );

    return fileRepository.create({
      workspaceId,
      uploadedBy:   context.userId,
      originalName: multerFile.originalname,
      storageKey,
      mimeType:     multerFile.mimetype,
      sizeBytes:    multerFile.size,
    });
  },

  /**
   * Returns the resolved absolute path for streaming.
   * Validates workspace access and that the file belongs to this workspace.
   */
  async getForDownload(workspaceId, fileId, context) {
    await workspaceService.getById(workspaceId, context);
    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File not found');
    if (String(file.workspaceId) !== String(workspaceId)) {
      throw new ForbiddenError('File does not belong to this workspace');
    }
    return {
      absolutePath: StorageService.resolve(file.storageKey),
      originalName: file.originalName,
      mimeType:     file.mimeType,
    };
  },

  /**
   * Soft-deletes a file.
   * Only the uploader or an admin may delete.
   */
  async remove(workspaceId, fileId, context) {
    await workspaceService.getById(workspaceId, context);
    const file = await fileRepository.findById(fileId);
    if (!file) throw new NotFoundError('File not found');
    if (String(file.workspaceId) !== String(workspaceId)) {
      throw new ForbiddenError('File does not belong to this workspace');
    }
    if (context.role !== 'admin' && String(file.uploadedBy._id ?? file.uploadedBy) !== String(context.userId)) {
      throw new ForbiddenError('You can only delete your own files');
    }
    await fileRepository.softDelete(fileId, context.userId);
  },
};

module.exports = fileService;
