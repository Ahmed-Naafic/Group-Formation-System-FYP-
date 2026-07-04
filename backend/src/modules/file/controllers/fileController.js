const asyncHandler    = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const fileService     = require('../services/fileService');
const StorageService  = require('../../../common/services/storage/StorageService');
const { BadRequestError } = require('../../../common/errors');

const fileController = {
  list: asyncHandler(async (req, res) => {
    const files = await fileService.list(req.params.workspaceId, req.context);
    return sendSuccess(res, { data: { files } });
  }),

  upload: asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No file provided');
    const file = await fileService.upload(req.params.workspaceId, req.file, req.context);
    return sendSuccess(res, { status: 201, data: { file } });
  }),

  download: asyncHandler(async (req, res) => {
    const { publicId } = await fileService.getForDownload(
      req.params.workspaceId, req.params.fileId, req.context,
    );
    const signedUrl = await StorageService.createSignedUrl(publicId);
    return res.redirect(signedUrl);
  }),

  remove: asyncHandler(async (req, res) => {
    await fileService.remove(req.params.workspaceId, req.params.fileId, req.context);
    return sendSuccess(res, { message: 'File deleted' });
  }),
};

module.exports = fileController;
