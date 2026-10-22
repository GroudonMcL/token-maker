// Picture (PNG) frames (DESIGN.md §6.9). The built-in ones are drawn by code
// (scripts/make-frames.ts) and saved in public/frames/; uploaded ones are
// kept in IndexedDB (src/state/frameLibrary.ts). Either way the picture is
// held in the asset store under frameAssetId(), and it fills the token's
// square, so it scales with the token.

import type { ImageFrame, ImageFrameSource } from '../document/types';
import type { Ctx } from './frameKit';

export interface LibraryFrame {
  id: string;
  name: string;
}

export const FRAME_LIBRARY: readonly LibraryFrame[] = [
  { id: 'gilded-laurel', name: 'Gilded laurel' },
  { id: 'iron-rivets', name: 'Iron rivets' },
  { id: 'runestone', name: 'Runestone' },
  { id: 'thorns', name: 'Thorns' },
  { id: 'dragon-scales', name: 'Dragon scales' },
  { id: 'celestial', name: 'Celestial star' },
  { id: 'rope', name: 'Rope' },
  { id: 'shield-rim', name: 'Shield rim' },
];

export const frameImageUrl = (id: string) => `/frames/${id}.webp`;
export const frameThumbUrl = (id: string) => `/frames/${id}-thumb.webp`;

/** The asset-store key of a picture frame. */
export const frameAssetId = (source: ImageFrameSource) => `frame:${source.type}:${source.id}`;

/** The picture frame the document uses, or null for a code-drawn frame. */
export const activeImageFrame = (frame: { kind: string; image: ImageFrame | null }): ImageFrame | null =>
  frame.kind === 'image' ? frame.image : null;

/** Draws a frame picture filling the token's square (fitted, keeping its shape), centred on the origin. */
export function drawImageFrame(ctx: Ctx, image: { image: CanvasImageSource; width: number; height: number }, R: number): void {
  const k = (2 * R) / Math.max(image.width, image.height);
  const w = image.width * k;
  const h = image.height * k;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image.image, -w / 2, -h / 2, w, h);
}
