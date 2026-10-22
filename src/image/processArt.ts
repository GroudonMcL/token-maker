// The "processed art" step (DESIGN.md §5, layer 5): the original image with
// its adjustments, background-removal mask and brush strokes applied. Lighting
// joins in Phase 4. The result is one bitmap, cached per image and per
// resolution, that only recomputes the parts whose inputs changed:
//
// - adjustments changed      → re-adjust the pixels (the slow part);
// - removal settings changed → rebuild the mask from the original colours;
// - a brush stroke grew      → paint just the new bit of the stroke.
//
// While a slider is dragged the editor asks for a smaller copy (`maxSide`) so
// it stays smooth on phones; the export always uses the full working size.

import type { ArtLayer, BrushStroke } from '../document/types';
import type { RenderSource } from '../render/render';
import { adjustPixels, isNeutral, type PixelBuffer } from './adjust';
import { applyCoverage, applyStrokes, paintCoverage, type Rect } from './brush';
import { detectBackground, removalMask } from './removal';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type CanvasFactory = (w: number, h: number) => AnyCanvas;

let makeCanvas: CanvasFactory = (w, h) => {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
};

/** Lets tests outside a browser supply their own canvases. */
export function setCanvasFactory(factory: CanvasFactory): void {
  makeCanvas = factory;
}

/** A new canvas from the current factory (the browser's, or a test's). */
export const newCanvas = (w: number, h: number) => makeCanvas(w, h);

export type ArtSettings = Pick<ArtLayer, 'adjust' | 'removal' | 'strokes'>;

interface Level {
  w: number;
  h: number;
  original: PixelBuffer;
  adjKey: string;
  adjusted: PixelBuffer | null;
  removalKey: string;
  base: Uint8Array | null;
  mask: Uint8Array | null;
  /** Strokes painted on `mask`, and how many points of the last one. */
  strokes: readonly BrushStroke[];
  lastPoints: number;
  /** For the stroke being drawn: the mask before it, and its coverage so far. */
  before: Uint8Array | null;
  cov: Uint8Array | null;
  canvas: AnyCanvas;
  ctx: Ctx2D;
  out: ImageData;
  outKey: string;
}

const MAX_LEVELS = 3;
const cache = new WeakMap<object, Map<number, Level>>();

const isPlain = (s: ArtSettings) => isNeutral(s.adjust) && !s.removal.enabled && s.strokes.length === 0;
const removalKeyOf = (s: ArtSettings) => (s.removal.enabled ? JSON.stringify(s.removal) : 'off');

function levelSide(source: RenderSource, maxSide?: number): number {
  return Math.max(1, Math.round(Math.min(maxSide ?? Infinity, Math.max(source.width, source.height))));
}

function getLevel(source: RenderSource, side: number): Level {
  let levels = cache.get(source.image as object);
  if (!levels) {
    levels = new Map();
    cache.set(source.image as object, levels);
  }
  let level = levels.get(side);
  if (level) {
    // Most recently used last, so the oldest is dropped first.
    levels.delete(side);
    levels.set(side, level);
    return level;
  }
  const k = side / Math.max(source.width, source.height);
  const w = Math.max(1, Math.round(source.width * k));
  const h = Math.max(1, Math.round(source.height * k));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Ctx2D;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source.image as CanvasImageSource, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h);
  level = {
    w,
    h,
    original: { data: new Uint8ClampedArray(px.data), width: w, height: h },
    adjKey: '',
    adjusted: null,
    removalKey: '',
    base: null,
    mask: null,
    strokes: [],
    lastPoints: 0,
    before: null,
    cov: null,
    canvas,
    ctx,
    out: px,
    outKey: '',
  };
  levels.set(side, level);
  while (levels.size > MAX_LEVELS) levels.delete(levels.keys().next().value!);
  return level;
}

/** Brings the mask up to date with the strokes; returns the area that changed, or 'all'. */
function updateMask(level: Level, settings: ArtSettings, rebuild: boolean): Rect | 'all' | null {
  const { w, h } = level;
  const cur = settings.strokes;
  const prev = level.strokes;
  const samePrefix = (n: number) => {
    for (let i = 0; i < n; i++) if (cur[i] !== prev[i]) return false;
    return true;
  };
  if (!rebuild && level.mask && cur === prev) return null;
  const n = cur.length;
  const last = cur[n - 1];
  // The stroke being drawn grew: paint only the new part.
  if (!rebuild && level.mask && last && level.before && level.cov && n === prev.length && samePrefix(n - 1) && last.id === prev[n - 1]!.id) {
    const from = level.lastPoints;
    level.strokes = cur;
    level.lastPoints = Math.floor(last.points.length / 3);
    const rect = paintCoverage(level.cov, w, h, last, from);
    if (rect) applyCoverage(level.mask, level.before, level.cov, w, last.mode, rect);
    return rect;
  }
  // A new stroke started: remember the mask under it.
  if (!rebuild && level.mask && last && n === prev.length + 1 && samePrefix(n - 1)) {
    level.before = level.mask.slice();
    level.cov = new Uint8Array(w * h);
    level.strokes = cur;
    level.lastPoints = Math.floor(last.points.length / 3);
    const rect = paintCoverage(level.cov, w, h, last, 0);
    if (rect) applyCoverage(level.mask, level.before, level.cov, w, last.mode, rect);
    return rect;
  }
  // Anything else (undo, a new image, removal changed): start again from the removal mask.
  level.mask = level.base ? level.base.slice() : new Uint8Array(w * h).fill(255);
  applyStrokes(level.mask, w, h, cur);
  level.strokes = cur;
  level.lastPoints = last ? Math.floor(last.points.length / 3) : 0;
  level.before = null;
  level.cov = null;
  return 'all';
}

/** Writes adjusted colours × mask into the output bitmap, inside `rect`. */
function writeOut(level: Level, rect: Rect): void {
  const { w } = level;
  const src = level.adjusted!.data;
  const mask = level.mask;
  const out = level.out.data;
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let p = y * w + rect.x0, end = y * w + rect.x1; p < end; p++) {
      const i = p * 4;
      out[i] = src[i]!;
      out[i + 1] = src[i + 1]!;
      out[i + 2] = src[i + 2]!;
      out[i + 3] = mask ? (src[i + 3]! * mask[p]!) / 255 : src[i + 3]!;
    }
  }
  level.ctx.putImageData(level.out, 0, 0, rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
}

/**
 * The art ready to draw. Width and height are always the original image's,
 * whatever resolution was processed, so the art's position and size on the
 * token never depend on the preview quality.
 */
export function processArt(source: RenderSource, settings: ArtSettings, maxSide?: number): RenderSource {
  if (isPlain(settings)) return source;
  const level = getLevel(source, levelSide(source, maxSide));
  const all: Rect = { x0: 0, y0: 0, x1: level.w, y1: level.h };

  const adjKey = JSON.stringify(settings.adjust);
  const adjChanged = adjKey !== level.adjKey || !level.adjusted;
  if (adjChanged) {
    level.adjusted = adjustPixels(level.original, settings.adjust);
    level.adjKey = adjKey;
  }
  const removalKey = removalKeyOf(settings);
  const removalChanged = removalKey !== level.removalKey;
  if (removalChanged) {
    // From the original colours, so tuning the picture never changes the cut.
    level.base = settings.removal.enabled ? removalMask(level.original, settings.removal) : null;
    level.removalKey = removalKey;
  }
  const masked = settings.removal.enabled || settings.strokes.length > 0;
  let dirty: Rect | 'all' | null = null;
  if (masked) dirty = updateMask(level, settings, removalChanged);
  else if (level.mask) {
    level.mask = null;
    level.strokes = [];
    dirty = 'all';
  }
  const outKey = `${adjKey}|${removalKey}`;
  if (adjChanged || outKey !== level.outKey) dirty = 'all';
  level.outKey = outKey;
  if (dirty) writeOut(level, dirty === 'all' ? all : dirty);
  return { image: level.canvas as CanvasImageSource, width: source.width, height: source.height };
}

/** True when the full-size art would need the slow recompute (new adjustments or removal settings). */
export function needsHeavyWork(source: RenderSource, settings: ArtSettings): boolean {
  if (isPlain(settings)) return false;
  const level = cache.get(source.image as object)?.get(levelSide(source));
  return !level || level.adjKey !== JSON.stringify(settings.adjust) || level.removalKey !== removalKeyOf(settings);
}

/** The original pixels at (up to) `maxSide`, for the eyedropper and background detection. */
function originalPixels(source: RenderSource, maxSide: number): PixelBuffer {
  return getLevel(source, levelSide(source, maxSide)).original;
}

/** The background colour removal would use when none was picked. */
export function detectedBackground(source: RenderSource, intensity: number): string {
  return detectBackground(originalPixels(source, 512), intensity);
}

/** The original colour at (fx, fy), as fractions of the image's width and height. */
export function sampleOriginal(source: RenderSource, fx: number, fy: number): string {
  const buf = originalPixels(source, Math.max(source.width, source.height));
  const x = Math.min(buf.width - 1, Math.max(0, Math.floor(fx * buf.width)));
  const y = Math.min(buf.height - 1, Math.max(0, Math.floor(fy * buf.height)));
  const i = (y * buf.width + x) * 4;
  return '#' + [buf.data[i]!, buf.data[i + 1]!, buf.data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('');
}
