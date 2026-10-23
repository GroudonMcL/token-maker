// The processed-art bitmap (DESIGN.md §5 step 5), cached per picture and size
// so it is only recomputed when its inputs change:
//
//   - full size (the picture's own working size) for the export and the
//     settled preview; normally computed in the Web Worker (artWorker.ts)
//   - a quick copy at DRAFT_SIDE for the preview while a slider or brush is
//     being dragged, computed here because it only takes a few milliseconds
//
// Both are drawn at the picture's own width and height, so swapping one for
// the other never moves the art.

import type { RenderSource } from '../render/render';
import type { PixelBuffer } from './adjust';
import { editsKey, isUnedited, processPixels, type ArtEdits, type ProcessCache } from './process';

export const DRAFT_SIDE = 512;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2d = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

let makeCanvas = (w: number, h: number): AnyCanvas => {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
};

/** A new canvas from the current maker (the browser's, or a test's). */
export const newCanvas = (w: number, h: number): AnyCanvas => makeCanvas(w, h);

/** Tests outside the browser pass their own canvas maker. */
export function setCanvasFactory(factory: (w: number, h: number) => AnyCanvas): void {
  makeCanvas = factory;
}

export interface ProcessedArt {
  /** Draw this exactly like the original picture (same width and height). */
  source: RenderSource;
  /** Keep-mask at `maskWidth` × `maskHeight` (255 = keep), or null when nothing is removed. */
  mask: Uint8Array | null;
  maskWidth: number;
  maskHeight: number;
}

interface SizeEntry {
  pixels: PixelBuffer;
  cache: ProcessCache;
  result?: { key: string; art: ProcessedArt };
}

/** Per picture (keyed by its image object, so a new import never mixes up caches). */
const pictures = new WeakMap<object, Map<number, SizeEntry>>();

/** The longest side the full-size result uses: the picture's own size. */
export const fullSide = (src: RenderSource) => Math.max(src.width, src.height);

/** The picture's pixels, scaled so its longer side is at most `side`. */
export function sourcePixels(src: RenderSource, side: number): PixelBuffer {
  return entry(src, side).pixels;
}

function entry(src: RenderSource, side: number): SizeEntry {
  let sizes = pictures.get(src.image);
  if (!sizes) pictures.set(src.image, (sizes = new Map()));
  const s = Math.min(side, fullSide(src));
  let e = sizes.get(s);
  if (!e) {
    const k = s / fullSide(src);
    const w = Math.max(1, Math.round(src.width * k));
    const h = Math.max(1, Math.round(src.height * k));
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d') as Ctx2d;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src.image, 0, 0, w, h);
    e = { pixels: { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }, cache: {} };
    sizes.set(s, e);
  }
  return e;
}

function toArt(src: RenderSource, pixels: PixelBuffer, mask: Uint8Array | null): ProcessedArt {
  const c = makeCanvas(pixels.width, pixels.height);
  const ctx = c.getContext('2d') as Ctx2d;
  const img = ctx.createImageData(pixels.width, pixels.height);
  img.data.set(pixels.data);
  ctx.putImageData(img, 0, 0);
  return { source: { image: c, width: src.width, height: src.height }, mask, maskWidth: pixels.width, maskHeight: pixels.height };
}

const unedited = (src: RenderSource): ProcessedArt => ({ source: src, mask: null, maskWidth: 0, maskHeight: 0 });

/** The processed art if it is already computed at this size, else null. */
export function peekProcessedArt(src: RenderSource, edits: ArtEdits, side = fullSide(src)): ProcessedArt | null {
  if (isUnedited(edits)) return unedited(src);
  const s = Math.min(side, fullSide(src));
  const r = pictures.get(src.image)?.get(s)?.result;
  return r && r.key === editsKey(edits) ? r.art : null;
}

/** The processed art at this size, computed now if needed. */
export function processedArt(src: RenderSource, edits: ArtEdits, side = fullSide(src)): ProcessedArt {
  const ready = peekProcessedArt(src, edits, side);
  if (ready) return ready;
  const e = entry(src, side);
  const { pixels, mask } = processPixels(e.pixels, edits, e.cache);
  const art = toArt(src, pixels, mask);
  e.result = { key: editsKey(edits), art };
  return art;
}

/** Stores a result computed elsewhere (the worker) for these edits at full size. */
export function storeProcessedArt(src: RenderSource, edits: ArtEdits, pixels: PixelBuffer, mask: Uint8Array | null): ProcessedArt {
  const e = entry(src, fullSide(src));
  const art = toArt(src, pixels, mask);
  e.result = { key: editsKey(edits), art };
  return art;
}

/** Drops everything cached for a picture; it is worked out again if needed. */
export function forgetProcessedArt(src: RenderSource): void {
  pictures.delete(src.image);
}
