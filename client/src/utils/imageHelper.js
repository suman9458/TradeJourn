/**
 * Client-side Image Optimization Utility for TradeJourn
 * Scales high-resolution trading charts & screenshots down to optimal storage size
 * while preserving crystal-clear price action and candlestick details.
 */
import { api } from '../services/api';
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

/**
 * Compresses an image and uploads it to Cloudinary CDN via the backend.
 * Returns the CDN URL (or data URL fallback if offline / unconfigured).
 */
export const processAndUploadChartImage = async (fileOrUrl) => {
  if (!fileOrUrl) return '';

  // If already an HTTP/HTTPS URL (e.g. TradingView link or existing Cloudinary URL), return directly
  if (typeof fileOrUrl === 'string' && (fileOrUrl.startsWith('http://') || fileOrUrl.startsWith('https://'))) {
    return fileOrUrl;
  }

  // Optimize and compress locally in browser first
  let dataUrl;
  try {
    dataUrl = typeof fileOrUrl === 'string' ? fileOrUrl : await compressImageFile(fileOrUrl);
  } catch (compressErr) {
    console.warn('Image compression warning, using raw input:', compressErr);
    dataUrl = fileOrUrl;
  }

  // Upload to Cloudinary via server API
  try {
    if (api && typeof api.uploadImage === 'function') {
      const res = await api.uploadImage(dataUrl);
      if (res && res.success && res.url) {
        return res.url;
      }
    }
  } catch (uploadErr) {
    console.warn('Cloudinary upload notice (fallback to inline data):', uploadErr?.message || uploadErr);
  }

  // Safe fallback to dataUrl
  return dataUrl;
};

/**
 * Safely extracts up to 3 image URLs from any trade object,
 * seamlessly bridging newer `images` arrays and legacy single `screenshotUrl`/`imageUrl`.
 */
export const getTradeImages = (trade) => {
  if (!trade) return [];
  if (Array.isArray(trade.images) && trade.images.length > 0) {
    const list = trade.images
      .filter((img) => typeof img === 'string' && img.trim() !== '')
      .slice(0, 3);
    if (list.length > 0) return list;
  }
  const fallback = trade.screenshotUrl || trade.imageUrl;
  if (fallback && typeof fallback === 'string' && fallback.trim() !== '') {
    return [fallback.trim()];
  }
  return [];
};

/**
 * Batch processes up to the remaining allowed image count (maximum 3 total).
 */
export const processAndUploadMultipleImages = async (filesOrUrls, currentCount = 0, maxTotal = 3) => {
  if (!filesOrUrls) return [];
  const items = Array.isArray(filesOrUrls) ? filesOrUrls : Array.from(filesOrUrls);
  const remainingSlots = Math.max(0, maxTotal - currentCount);
  const toProcess = items.slice(0, remainingSlots);

  const results = [];
  for (const item of toProcess) {
    try {
      const url = await processAndUploadChartImage(item);
      if (url) results.push(url);
    } catch (err) {
      console.warn('Failed to process image item:', err);
    }
  }
  return results;
};
