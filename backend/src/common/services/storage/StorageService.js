const nodeHttps = require('https');
const path      = require('path');
const crypto    = require('crypto');
const { createClient } = require('@supabase/supabase-js');

let _client = null;
const BUCKET = 'gf-system-files';

function getClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are required');
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

const StorageService = {
  async save(buffer, originalName, folder = '', mimeType = 'application/octet-stream') {
    const ext      = path.extname(originalName);
    const base     = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique   = crypto.randomBytes(8).toString('hex');
    const filename = `${Date.now()}-${unique}-${base}${ext}`;
    const filePath = folder ? `${folder}/${filename}` : filename;

    const { error } = await getClient()
      .storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: mimeType, upsert: false });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data } = getClient().storage.from(BUCKET).getPublicUrl(filePath);
    return { url: data.publicUrl, publicId: filePath };
  },

  async delete(publicId) {
    if (!publicId) return;
    const { error } = await getClient().storage.from(BUCKET).remove([publicId]);
    if (error && !error.message.includes('Not Found')) throw new Error(`Supabase delete failed: ${error.message}`);
  },

  // Stream a stored file directly to an Express response without buffering.
  // Uses the authenticated Supabase endpoint so it works for private buckets.
  streamFile(publicId, originalName, mimeType, res) {
    const base = process.env.SUPABASE_URL.replace(/\/$/, '');
    const storageUrl = `${base}/storage/v1/object/${BUCKET}/${publicId}`;
    const parsed = new URL(storageUrl);

    return new Promise((resolve, reject) => {
      nodeHttps.get(
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
            upstream.resume();
            return reject(new Error(`Supabase storage returned ${upstream.statusCode} for ${publicId}`));
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
  },
};

module.exports = StorageService;
