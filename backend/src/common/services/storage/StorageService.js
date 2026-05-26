const path   = require('path');
const fs     = require('fs/promises');
const crypto = require('crypto');

// Absolute path to the uploads root — swap this one line to change the base location.
// All storageKey values stored in the DB are relative to this root so S3 migration
// only requires replacing this service, not touching any DB records.
// Resolves to <backend-root>/uploads — one level above src/
const UPLOADS_ROOT = path.resolve(__dirname, '../../../../uploads');

const StorageService = {
  /**
   * Persists a file buffer to disk under <folder>/<unique-filename>.
   * Returns the storageKey (path relative to UPLOADS_ROOT) to store in the DB.
   */
  async save(buffer, originalName, folder = '') {
    const ext      = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique   = crypto.randomBytes(8).toString('hex');
    const filename = `${Date.now()}-${unique}-${baseName}${ext}`;

    const dir      = folder ? path.join(UPLOADS_ROOT, folder) : UPLOADS_ROOT;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buffer);

    return folder ? `${folder}/${filename}` : filename;
  },

  /**
   * Deletes a file identified by its storageKey.
   * Silently succeeds if the file no longer exists (idempotent).
   */
  async delete(storageKey) {
    try {
      await fs.unlink(path.join(UPLOADS_ROOT, storageKey));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  },

  /**
   * Resolves a storageKey to an absolute path for streaming / res.sendFile.
   */
  resolve(storageKey) {
    return path.join(UPLOADS_ROOT, storageKey);
  },
};

module.exports = StorageService;
