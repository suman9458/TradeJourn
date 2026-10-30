const { z } = require('zod');

const uploadImageSchema = z.object({
  image: z.string().trim()
    .min(50, 'Image data is too short to be a valid data URI')
    .max(14 * 1024 * 1024, 'Image size exceeds maximum limit of 10MB')
    .regex(/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i, 'Invalid image format. Allowed formats: JPEG, PNG, WEBP, GIF.')
});

const deleteImageSchema = z.object({
  publicId: z.string().trim()
    .min(5, 'Valid publicId required')
    .max(250, 'publicId too long')
    .refine(val => !val.includes('..') && !val.includes('\\'), {
      message: 'Path traversal characters are prohibited in publicId'
    })
});

module.exports = {
  uploadImageSchema,
  deleteImageSchema
};

