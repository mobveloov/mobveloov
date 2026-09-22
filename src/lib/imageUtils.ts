/**
 * Converts an image File to WebP format, resizing to max 1200px on the longest side.
 * Returns a WebP File ready for upload.
 */
export async function convertToWebP(
  file: File,
  maxSize = 1200,
  quality = 0.82,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxSize || height > maxSize) {
    const ratio = width > height ? maxSize / width : maxSize / height;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
}
