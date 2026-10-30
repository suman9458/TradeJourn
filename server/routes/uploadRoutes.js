const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinary');
const { protect, preventDemoModification } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { uploadImageSchema, deleteImageSchema } = require('../validators/uploadValidators');

// Scoped 12MB body parser applied ONLY to image uploads (global API remains strictly 100kb)
const uploadJsonParser = express.json({ limit: '12mb' });

/**
 * Validates real binary magic bytes of the decoded buffer
 */
const validateMagicBytes = (base64String) => {
  try {
    const rawData = base64String.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(rawData, 'base64');
    if (buffer.length < 8) return false;

    // JPEG: FF D8 FF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    // PNG: 89 50 4E 47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    // GIF: 47 49 46 38
    const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
    // WebP: RIFF .... WEBP
    const isWebp = buffer.length > 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    return isJpeg || isPng || isGif || isWebp;
  } catch {
    return false;
  }
};

// POST /api/upload/image
// Accepts base64 data URL from frontend, uploads to Cloudinary, returns secure CDN URL
router.post('/image', protect, preventDemoModification, uploadJsonParser, validateBody(uploadImageSchema), async (req, res) => {
  try {
    const { image } = req.body;

    // SEC-MAGIC: Verify true binary file signature (magic bytes) to defeat content-type spoofing
    if (!validateMagicBytes(image)) {
      return res.status(400).json({
        success: false,
        message: 'File content rejected: binary signature does not match a valid JPEG, PNG, GIF, or WebP image.'
      });
    }

    // Check Cloudinary environment
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary storage is not configured on the server.'
      });
    }

    const userId = req.user._id.toString();
    const uploadFolder = `tradejourn/${userId}`;

    const result = await cloudinary.uploader.upload(image, {
      folder: uploadFolder,
      resource_type: 'image',
      quality: 'auto:good',
      format: 'webp',
      transformation: [
        { width: 1920, height: 1920, crop: 'limit' }
      ]
    });

    return res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes
    });
  } catch (err) {
    console.error('Cloudinary upload error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Image upload failed. Please try again.'
    });
  }
});

// DELETE /api/upload/image
// Removes image from Cloudinary
router.delete('/image', protect, preventDemoModification, validateBody(deleteImageSchema), async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId || typeof publicId !== 'string' || publicId.includes('..') || publicId.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Valid, sanitized publicId required' });
    }

    // SEC-07 Hardening: Prevent IDOR - ensure users can only delete their own Cloudinary assets
    const userId = req.user._id.toString();
    const expectedPrefix = `tradejourn/${userId}/`;

    if (!publicId.startsWith(expectedPrefix) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to delete this asset.'
      });
    }

    if (process.env.CLOUDINARY_API_KEY) {
      await cloudinary.uploader.destroy(publicId);
    }
    return res.json({ success: true, message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Cloudinary deletion error:', err.message);
    return res.status(500).json({ success: false, message: 'Image deletion failed' });
  }
});

module.exports = router;
