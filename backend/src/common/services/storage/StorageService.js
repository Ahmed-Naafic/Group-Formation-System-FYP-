const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');

// CLOUDINARY_URL is read automatically by the SDK.
// Set it in Render's Environment Variables:
//   CLOUDINARY_URL = cloudinary://API_KEY:API_SECRET@CLOUD_NAME

const StorageService = {
  /**
   * Uploads a file buffer to Cloudinary.
   * Returns { url, publicId } — both are persisted to the DB.
   * `folder` maps to the Cloudinary folder, e.g. "workspaces/abc123".
   */
  async save(buffer, originalName, folder = '') {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'raw',  // handles all types: images, PDFs, docs, zips, etc.
          use_filename:  false,   // let Cloudinary generate the public_id
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  },

  /**
   * Deletes a file from Cloudinary by its publicId.
   * Silently succeeds if the file no longer exists.
   */
  async delete(publicId) {
    if (!publicId) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (err) {
      const code = err?.http_code ?? err?.error?.http_code;
      if (code !== 404) throw err;
    }
  },
};

module.exports = StorageService;
