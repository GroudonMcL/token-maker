// Pop-out (DESIGN.md §6.6): the parts of the art drawn again on top of the
// border. The mask is painted with strokes in the picture's own 0–1
// coordinates; the pop-out bitmap is the processed art (the very same
// bitmap the inside art is drawn from) with the mask applied to its alpha,
// at the same pixel size, so where the two meet there is no seam.

import type { PopOutStroke } from '../document/types';
import type { RenderSource } from '../render/render';
import { newCanvas } from './processedArt';
import { applyStrokes } from './strokes';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2d = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The mask's longer side: the art's working size (DESIGN.md §5). */
const MASK_SIDE = 2048;

/** Pixel size of an image the renderer was given (a canvas, bitmap or <img>). */
function pixelSize(image: CanvasImageSource, fallback: RenderSource): { w: number; h: number } {
  const i = image as { naturalWidth?: number; naturalHeight?: number; width?: unknown; height?: unknown };
  const w = i.naturalWidth || (typeof i.width === 'number' ? i.width : 0) || fallback.width;
  const h = i.naturalHeight || (typeof i.height === 'number' ? i.height : 0) || fallback.height;
  return { w, h };
}

interface MaskEntry {
  strokes: readonly PopOutStroke[];
  w: number;
  h: number;
  mask: Uint8Array;
  canvas: AnyCanvas;
  /** The mask with every stroke but the last, so painting only redraws the newest stroke. */
  beforeLast: Uint8Array;
  beforeLastStrokes: readonly PopOutStroke[];
}

/** One cached mask per picture (keyed by its image object). */
const masks = new WeakMap<object, MaskEntry>();

/** The pop-out mask (0–255, 255 = pops out) for a picture, at up to MASK_SIDE pixels. */
export function popOutMask(art: RenderSource, strokes: readonly PopOutStroke[]): MaskEntry {
  const k = Math.min(1, MASK_SIDE / Math.max(art.width, art.height));
  const w = Math.max(1, Math.round(art.width * k));
  const h = Math.max(1, Math.round(art.height * k));
  const hit = masks.get(art.image);
  if (hit && hit.strokes === strokes && hit.w === w && hit.h === h) return hit;

  const earlier = strokes.slice(0, -1);
  let beforeLast: Uint8Array;
  const same = hit && hit.w === w && hit.h === h && hit.beforeLastStrokes.length === earlier.length && earlier.every((s, i) => s === hit.beforeLastStrokes[i]);
  if (same) beforeLast = hit.beforeLast;
  else {
    beforeLast = new Uint8Array(w * h);
    applyStrokes(beforeLast, w, h, earlier);
  }
  const mask = beforeLast.slice();
  applyStrokes(mask, w, h, strokes.slice(-1));

  // As a canvas: white, with the mask as its alpha (for "destination-in").
  const canvas = hit && hit.w === w && hit.h === h ? hit.canvas : newCanvas(w, h);
  const ctx = canvas.getContext('2d') as Ctx2d;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = mask[p]!;
  }
  ctx.putImageData(img, 0, 0);
  const entry: MaskEntry = { strokes, w, h, mask, canvas, beforeLast, beforeLastStrokes: earlier };
  masks.set(art.image, entry);
  return entry;
}

/** One pop-out bitmap per processed-art bitmap, remembered with the mask it used. */
const bitmaps = new WeakMap<object, { mask: AnyCanvas; strokes: readonly PopOutStroke[]; source: RenderSource }>();

/**
 * The processed art with only the pop-out parts kept. Draw it exactly like
 * the processed art (same width and height, same transform).
 */
export function popOutArt(art: RenderSource, processed: RenderSource, strokes: readonly PopOutStroke[]): RenderSource {
  const m = popOutMask(art, strokes);
  const hit = bitmaps.get(processed.image);
  if (hit && hit.mask === m.canvas && hit.strokes === strokes) return hit.source;
  const { w, h } = pixelSize(processed.image, processed);
  const c = hit && pixelSize(hit.source.image, hit.source).w === w ? (hit.source.image as AnyCanvas) : newCanvas(w, h);
  const ctx = c.getContext('2d') as Ctx2d;
  ctx.save();
  ctx.globalCompositeOperation = 'copy';
  ctx.drawImage(processed.image, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(m.canvas as CanvasImageSource, 0, 0, w, h);
  ctx.restore();
  const source = { image: c as CanvasImageSource, width: processed.width, height: processed.height };
  bitmaps.set(processed.image, { mask: m.canvas, strokes, source });
  return source;
}

/** True when the document has a pop-out to draw. */
export const hasPopOut = (popOut: { enabled: boolean; strokes: readonly unknown[] }) => popOut.enabled && popOut.strokes.length > 0;
