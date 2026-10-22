// Decodes an image file into a bounded working copy (ported from the
// extension). Large art is downscaled once, so dragging and zooming never
// touch a 6000 px bitmap.

export const WORKING_MAX_SIDE = 2048;
/** Refuse absurd images (e.g. 20k × 20k) that would exhaust memory. */
const MAX_SOURCE_PIXELS = 80_000_000;

export class ImageDecodeError extends Error {}

export interface DecodedImage {
  image: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Image types we accept from files, drops and pastes (DESIGN.md §6.1). */
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/svg+xml'];

export function isImageFile(file: { type: string; name?: string }): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif|bmp|svg)$/i.test(file.name ?? '');
}

async function toBitmapSource(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // SVG can't go through createImageBitmap in every browser; an <img> rasterises it.
  if (blob.type !== 'image/svg+xml') {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    let { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) {
      // SVGs without a size: give them a sensible one.
      width = 1024;
      height = 1024;
    }
    return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageDecodeError("This file couldn't be opened as an image. Try saving it as PNG or JPG.");
  }
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  const { source, width, height, close } = await toBitmapSource(blob);
  try {
    if (width === 0 || height === 0) throw new ImageDecodeError('This image is empty.');
    if (width * height > MAX_SOURCE_PIXELS) throw new ImageDecodeError('This image is too large to edit.');
    const scale = Math.min(1, WORKING_MAX_SIDE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h); // GIFs give their first frame
    return { image: canvas, width: w, height: h };
  } finally {
    close();
  }
}
