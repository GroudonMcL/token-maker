// "Processed art" (DESIGN.md §5 step 5): the art's own pixels after
// adjustments → background-removal mask → brush strokes → blur/sharpen →
// lighting (Phase 4). The move/zoom/rotate transform is applied when the
// bitmap is drawn, so dragging the art never recomputes it.
//
// Everything here is plain pixel maths on arrays, so it runs the same on the
// main thread, in the Web Worker and in tests. A ProcessCache remembers each
// stage, so changing Brightness doesn't redo the background flood-fill and a
// brush stroke doesn't redo the colours.

import type { ArtLayer } from '../document/types';
import { parseHex } from '../render/color';
import { adjustColours, hasColourAdjustments, type PixelBuffer } from './adjust';
import { blurImage, sharpenImage } from './filters';
import { removalMask, type Rgb } from './removal';
import { applyStrokes } from './strokes';

export type ArtEdits = Pick<ArtLayer, 'adjust' | 'removal' | 'strokes'>;

export interface ProcessResult {
  pixels: PixelBuffer;
  /** The keep-mask (255 = keep), or null when nothing is removed. */
  mask: Uint8Array | null;
}

/** True when the art looks exactly like the picture (nothing to compute). */
export function isUnedited(e: ArtEdits): boolean {
  return !hasColourAdjustments(e.adjust) && e.adjust.blur === 0 && e.adjust.sharpness === 0 && !hasMask(e);
}

export const hasMask = (e: ArtEdits) => e.removal.enabled || e.strokes.length > 0;

let lastKey: { adjust: unknown; removal: unknown; strokes: unknown; key: string } | null = null;

/** A text key for exactly the inputs that change the result (remembered, as strokes can be long). */
export function editsKey(e: ArtEdits): string {
  if (lastKey && lastKey.adjust === e.adjust && lastKey.removal === e.removal && lastKey.strokes === e.strokes) return lastKey.key;
  const key = JSON.stringify([e.adjust, e.removal.enabled ? e.removal : 0, e.strokes]);
  lastKey = { adjust: e.adjust, removal: e.removal, strokes: e.strokes, key };
  return key;
}

/** Remembers intermediate results for one source picture at one size. */
export interface ProcessCache {
  colourKey?: string;
  colour?: Uint8ClampedArray;
  autoKey?: string;
  auto?: Uint8Array;
  maskKey?: string;
  mask?: Uint8Array | null;
  /** The mask with every stroke but the last drawn, and which strokes those were. */
  beforeLast?: Uint8Array;
  beforeLastAuto?: string;
  beforeLastStrokes?: ArtEdits['strokes'];
}

const removalColor = (hex: string | null): Rgb | null => {
  if (!hex) return null;
  const { r, g, b } = parseHex(hex);
  return [r, g, b];
};

function keepMask(src: PixelBuffer, e: ArtEdits, cache: ProcessCache): Uint8Array | null {
  if (!hasMask(e)) return null;
  const { width: w, height: h } = src;
  const autoKey = JSON.stringify(e.removal.enabled ? e.removal : 0);
  if (cache.autoKey !== autoKey || !cache.auto) {
    cache.auto = e.removal.enabled
      ? removalMask(src, { color: removalColor(e.removal.color), intensity: e.removal.intensity, softness: e.removal.softness })
      : new Uint8Array(w * h).fill(255);
    cache.autoKey = autoKey;
    cache.maskKey = undefined;
  }
  const maskKey = autoKey + JSON.stringify(e.strokes);
  if (cache.maskKey === maskKey && cache.mask) return cache.mask;

  // While painting, only the last stroke changes: start from the mask with
  // every earlier stroke drawn (unchanged strokes keep their identity).
  const earlier = e.strokes.slice(0, -1);
  const prev = cache.beforeLastStrokes;
  if (!cache.beforeLast || cache.beforeLastAuto !== autoKey || !prev || prev.length !== earlier.length || prev.some((s, i) => s !== earlier[i])) {
    const before = cache.auto.slice();
    applyStrokes(before, w, h, earlier);
    cache.beforeLast = before;
    cache.beforeLastAuto = autoKey;
    cache.beforeLastStrokes = earlier;
  }
  const mask = cache.beforeLast.slice();
  applyStrokes(mask, w, h, e.strokes.slice(-1));
  cache.mask = mask;
  cache.maskKey = maskKey;
  return mask;
}

/** Runs the whole pipeline. `src` is never changed. */
export function processPixels(src: PixelBuffer, e: ArtEdits, cache: ProcessCache = {}): ProcessResult {
  const { width: w, height: h } = src;
  const colourKey = JSON.stringify(e.adjust);
  if (cache.colourKey !== colourKey || !cache.colour) {
    const colour = { data: src.data.slice(), width: w, height: h };
    adjustColours(colour, e.adjust);
    cache.colour = colour.data;
    cache.colourKey = colourKey;
  }
  const out: PixelBuffer = { data: cache.colour.slice(), width: w, height: h };
  const mask = keepMask(src, e, cache);
  if (mask) {
    const d = out.data;
    for (let p = 0, i = 3; p < mask.length; p++, i += 4) if (mask[p] !== 255) d[i] = (d[i]! * mask[p]!) / 255;
  }
  const long = Math.max(w, h);
  // Blur: 100 = 2 % of the longer side. Sharpen at about 1/1600 of it (≈1.3 px on a 2048 px image).
  if (e.adjust.blur > 0) blurImage(out, (e.adjust.blur / 100) * 0.02 * long);
  if (e.adjust.sharpness > 0) sharpenImage(out, (e.adjust.sharpness / 100) * 2, long / 1600);
  // Lighting joins here in Phase 4, so pop-out parts (Phase 5) are lit the same.
  return { pixels: out, mask };
}
