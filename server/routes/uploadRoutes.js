const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinary');
const { protect } = require('../middleware/auth');

// POST /api/upload/image
// Accepts base64 data URL from frontend, uploads to Cloudinary, returns secure CDN URL
router.post('/image', protect, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: 'No image data provided' });
    }

    // Check Cloudinary environment
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary storage is not configured on the server.'
      });
    }

    const userId = req.user?._id ? req.user._id.toString() : 'guest';
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
    console.error('Cloudinary upload error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Image upload failed'
    });
  }
});

// DELETE /api/upload/image
// Removes image from Cloudinary
router.delete('/image', protect, async (req, res) => {
  try {
    const { publicId } = req.body;
    if (publicId && process.env.CLOUDINARY_API_KEY) {
      await cloudinary.uploader.destroy(publicId);
    }
    return res.json({ success: true, message: 'Image deleted from Cloudinary' });
  } catch (err) {
    console.error('Cloudinary deletion error:', err);
    return res.status(500).json({ success: false, message: 'Image deletion failed' });
  }
});

module.exports = router;
