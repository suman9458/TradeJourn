/**
 * Client-side Image Optimization Utility for TradeJourn
 * Scales high-resolution trading charts & screenshots down to optimal storage size
 * while preserving crystal-clear price action and candlestick details.
 */

export const compressImageFile = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Please select a valid image file (PNG, JPG, WebP, GIF)'));
    }

    // For GIFs or SVGs, read directly as data URL to preserve vector/frames
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // If dimensions are within bounds and file is small (< 400KB), return original
        if (width <= maxWidth && height <= maxHeight && file.size < 400 * 1024) {
          return resolve(e.target.result);
        }

        // Scale proportionally if too large
        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first for optimal compression
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            return resolve(webpData);
          }
        } catch (ignored) {}

        // Fallback to high quality JPEG
        const jpegData = canvas.toDataURL('image/jpeg', quality);
        resolve(jpegData);
      };

      img.onerror = () => reject(new Error('Unable to process image file.'));
      img.src = e.target.result;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};
