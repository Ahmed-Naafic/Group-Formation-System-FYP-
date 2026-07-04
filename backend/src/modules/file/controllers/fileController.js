const https        = require('https');
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
    // Stream from Supabase directly to the client — no RAM buffering
    const parsed = new URL(url);
    await new Promise((resolve, reject) => {
      https.get(
        {
          hostname: parsed.hostname,
          path:     parsed.pathname + parsed.search,
          headers: {
            apikey:        process.env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          },
        },
        (upstream) => {
          if (upstream.statusCode >= 400) {
            upstream.resume(); // drain to free socket
            return reject(new Error(`Storage returned ${upstream.statusCode}`));
          }
          res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
          res.setHeader('Content-Type', mimeType || 'application/octet-stream');
          if (upstream.headers['content-length']) {
            res.setHeader('Content-Length', upstream.headers['content-length']);
          }
          upstream.pipe(res);
          upstream.on('end',   resolve);
          upstream.on('error', reject);
        },
      ).on('error', reject);
    });
  }),

  // DELETE /api/workspaces/:workspaceId/files/:fileId
  remove: asyncHandler(async (req, res) => {
    await fileService.remove(req.params.workspaceId, req.params.fileId, req.context);
    return sendSuccess(res, { message: 'File deleted' });
  }),
};

module.exports = fileController;
