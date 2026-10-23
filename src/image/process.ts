// "Processed art" (DESIGN.md §5 step 5): the art's own pixels after
// adjustments → background-removal mask → brush strokes → blur/sharpen →
// lighting (Phase 4). The move/zoom/rotate transform is applied when the
// bitmap is drawn, so dragging the art never recomputes it.
//
// Everything here is plain pixel maths on arrays, so it runs the same on the
// main thread, in the Web Worker and in tests. A ProcessCache remembers each
// stage, so changing Brightness doesn't redo the background flood-fill and a
// brush stroke doesn't redo the colours.

import type { ArtLayer, TokenDocument } from '../document/types';
import { parseHex } from '../render/color';
import { adjustColours, hasColourAdjustments, type PixelBuffer } from './adjust';
import { blurImage, blurMask, sharpenImage } from './filters';
import { removalMask, type Rgb } from './removal';
import { applyLighting, artLight, type ArtLight } from './lighting';
import { applyStrokes } from './strokes';

/** An AI cut-out mask for the picture (v8): 255 = keep, at its own size. `id` changes whenever the mask does. */
export interface AiMask {
  id: number;
  data: Uint8Array;
  width: number;
  height: number;
}

export type ArtEdits = Pick<ArtLayer, 'adjust' | 'removal' | 'strokes'> & {
  /** Lighting (Phase 4), already turned into the picture's own coordinates. */
  light?: ArtLight | null;
  /** The picture's AI cut-out mask, when AI removal is on and the mask is ready (v8). */
  aiMask?: AiMask | null;
};

/** Finds a picture's AI mask by its asset id; set by src/image/aiRemoval.ts (kept out of here so the worker never loads it). */
let findAiMask: (assetId: string) => AiMask | null = () => null;
export function setAiMaskLookup(find: (assetId: string) => AiMask | null): void {
  findAiMask = find;
}

const lightKeys = new Map<string, ArtLight>();
const editsByDoc = new WeakMap<TokenDocument, ArtEdits>();

/**
 * Everything that changes the processed art, taken from the document. The
 * same object comes back for the same document, and the light object is
 * reused while the light is unchanged, so caches can compare by identity.
 */
export function artEdits(doc: TokenDocument): ArtEdits {
  const r = doc.art.removal;
  const aiMask = r.enabled && r.method === 'ai' && doc.art.assetId ? findAiMask(doc.art.assetId) : null;
  let e = editsByDoc.get(doc);
  // The same document gets new edits when its AI mask arrives.
  if (e && (e.aiMask ?? null) === aiMask) return e;
  let light = artLight(doc.lighting, doc.art.transform);
  if (light) {
    const k = JSON.stringify(light);
    const known = lightKeys.get(k);
    if (known) light = known;
    else {
      if (lightKeys.size > 64) lightKeys.clear();
      lightKeys.set(k, light);
    }
  }
  e = { adjust: doc.art.adjust, removal: doc.art.removal, strokes: doc.art.strokes, light, aiMask };
  editsByDoc.set(doc, e);
  return e;
}

export interface ProcessResult {
  pixels: PixelBuffer;
  /** The keep-mask (255 = keep), or null when nothing is removed. */
  mask: Uint8Array | null;
}

/** True when the art looks exactly like the picture (nothing to compute). */
export function isUnedited(e: ArtEdits): boolean {
  return !hasColourAdjustments(e.adjust) && e.adjust.blur === 0 && e.adjust.sharpness === 0 && !hasMask(e) && !e.light;
}

export const hasMask = (e: ArtEdits) => e.removal.enabled || e.strokes.length > 0;

let lastKey: { adjust: unknown; removal: unknown; strokes: unknown; light: unknown; ai: unknown; key: string } | null = null;

/** The removal settings that change the keep-mask, with the AI mask's id when it is used. */
const removalKey = (e: ArtEdits) => JSON.stringify(e.removal.enabled ? [e.removal, e.removal.method === 'ai' ? (e.aiMask?.id ?? 0) : 0] : 0);

/** A text key for exactly the inputs that change the result (remembered, as strokes can be long). */
export function editsKey(e: ArtEdits): string {
  const light = e.light ?? null;
  const ai = e.aiMask ?? null;
  if (lastKey && lastKey.adjust === e.adjust && lastKey.removal === e.removal && lastKey.strokes === e.strokes && lastKey.light === light && lastKey.ai === ai) return lastKey.key;
  const key = JSON.stringify([e.adjust, removalKey(e), e.strokes, light]);
  lastKey = { adjust: e.adjust, removal: e.removal, strokes: e.strokes, light, ai, key };
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
  const autoKey = removalKey(e);
  if (cache.autoKey !== autoKey || !cache.auto) {
    const r = e.removal;
    cache.auto = !r.enabled
      ? new Uint8Array(w * h).fill(255)
      : r.method === 'ai'
        ? aiKeepMask(e.aiMask ?? null, w, h, r.softness)
        : removalMask(src, { color: removalColor(r.color), intensity: r.intensity, softness: r.softness, enclosed: r.enclosed });
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

/**
 * The AI mask stretched to the picture's working size (nothing is removed
 * while it's still being made), with the same Edge softness as flat-colour removal.
 */
export function aiKeepMask(ai: AiMask | null, w: number, h: number, softness: number): Uint8Array {
  const out = new Uint8Array(w * h).fill(255);
  if (!ai || !ai.width || !ai.height) return out;
  const sx = ai.width / w;
  const sy = ai.height / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(ai.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(ai.height - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(ai.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(ai.width - 1, x0 + 1);
      const tx = fx - x0;
      const a = ai.data[y0 * ai.width + x0]! * (1 - tx) + ai.data[y0 * ai.width + x1]! * tx;
      const b = ai.data[y1 * ai.width + x0]! * (1 - tx) + ai.data[y1 * ai.width + x1]! * tx;
      out[y * w + x] = Math.round(a * (1 - ty) + b * ty);
    }
  }
  blurMask(out, w, h, (softness / 100) * Math.max(2, 0.006 * Math.max(w, h)));
  return out;
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
  // Lighting last, so pop-out parts (Phase 5) are lit the same.
  if (e.light) applyLighting(out, e.light);
  return { pixels: out, mask };
}
