const path   = require('path');
const crypto = require('crypto');
const { getStorageBucket } = require('../../../config/firebase');

const StorageService = {
  /**
   * Uploads a file buffer to Firebase Storage.
   * Returns { url, publicId } — both are persisted to the DB.
   *   url      — permanent public HTTPS URL served via Google's CDN
   *   publicId — file path inside the bucket (used to delete the file later)
   */
  async save(buffer, originalName, folder = '', mimeType = 'application/octet-stream') {
    const bucket = getStorageBucket();
    if (!bucket) throw new Error('Firebase Storage is not initialised');

    const ext      = path.extname(originalName);
    const base     = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique   = crypto.randomBytes(8).toString('hex');
    const filename = `${Date.now()}-${unique}-${base}${ext}`;
    const filePath = folder ? `${folder}/${filename}` : filename;

    const file = bucket.file(filePath);
    await file.save(buffer, { metadata: { contentType: mimeType } });

    // Make the file publicly readable so clients can fetch it directly.
    await file.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    return { url, publicId: filePath };
  },

  /**
   * Deletes a file from Firebase Storage by its publicId (bucket path).
   * Silently succeeds if the file no longer exists.
   */
  async delete(publicId) {
    if (!publicId) return;
    const bucket = getStorageBucket();
    if (!bucket) return;
    try {
      await bucket.file(publicId).delete();
    } catch (err) {
      if (err?.code !== 404) throw err;
    }
  },
};

module.exports = StorageService;
