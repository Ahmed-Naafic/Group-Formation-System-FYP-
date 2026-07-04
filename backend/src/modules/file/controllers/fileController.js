const asyncHandler = require('../../../common/utils/asyncHandler');
const { sendSuccess } = require('../../../common/responses/apiResponse');
const fileService  = require('../services/fileService');
const { BadRequestError } = require('../../../common/errors');

const fileController = {
  // GET /api/workspaces/:workspaceId/files
  list: asyncHandler(async (req, res) => {
    const files = await fileService.list(req.params.workspaceId, req.context);
    return sendSuccess(res, { data: { files } });
  }),

  // POST /api/workspaces/:workspaceId/files  (multipart/form-data, field: "file")
  upload: asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No file provided');
    const file = await fileService.upload(req.params.workspaceId, req.file, req.context);
    return sendSuccess(res, { status: 201, data: { file } });
  }),

  // GET /api/workspaces/:workspaceId/files/:fileId/download
  download: asyncHandler(async (req, res) => {
    const { url, originalName, mimeType } = await fileService.getForDownload(
      req.params.workspaceId,
      req.params.fileId,
      req.context,
    );
    // Proxy through backend — avoids CORS issues and Supabase auth on clients
    const fileRes = await fetch(url, {
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!fileRes.ok) throw new Error(`Storage returned ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  }),

  // DELETE /api/workspaces/:workspaceId/files/:fileId
  remove: asyncHandler(async (req, res) => {
    await fileService.remove(req.params.workspaceId, req.params.fileId, req.context);
    return sendSuccess(res, { message: 'File deleted' });
  }),
};

module.exports = fileController;
