const path   = require('path');
const crypto = require('crypto');
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
};

module.exports = StorageService;
