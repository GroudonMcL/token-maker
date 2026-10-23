// Layer 11 (DESIGN.md §5, §6.9): decorations. Each one is a picture drawn by
// code (decorationPainters.ts), placed on a snap point round the frame
// (facing outwards) or freely, with an optional mirrored copy on the other
// side. Sizes are per grid square, so a horn is the same size on the map
// whatever the creature's size. Positions are in token units (R = 1, from
// the centre), so free decorations stay put when the token is resized.

import { decorationInfo } from '../document/defaults';
import { computeInsets } from '../document/sizing';
import type { Decoration, SnapPoint, TokenDocument } from '../document/types';
import { nudgedHole } from '../image/frameHole';
import { newCanvas } from '../image/processedArt';
import { DECORATION_PAINTERS } from './decorationPainters';
import type { Ctx } from './frameKit';
import { pictureAssetId } from './pictureLibrary';
import type { AssetMap, RenderSource } from './render';
import { shapePolygon, type Point } from './shapes';

/** Degrees round the token for each snap point (0 = right, 90 = bottom). */
export const SNAP_ANGLES: Record<SnapPoint, number> = {
  right: 0,
  bottomRight: 45,
  bottom: 90,
  bottomLeft: 135,
  left: 180,
  topLeft: 225,
  top: 270,
  topRight: 315,
};
export const SNAP_POINTS = Object.keys(SNAP_ANGLES) as SnapPoint[];

/** Where snapped decorations sit: the middle of the frame band, in token units. */
export interface DecorationGeometry {
  /** Distance from the centre to the band's middle line in the direction `deg`. */
  ringAt: (deg: number) => number;
  /** The token's size in grid squares (for per-square sizes). */
  squares: number;
}

/** One drawn copy of a decoration: where its anchor sits and how it is turned. */
export interface Placement {
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rotation: number;
  flip: boolean;
  /** The mirrored copy. */
  mirrored: boolean;
}

/** How far a ray from the centre at `deg` travels before leaving the polygon (0 when it doesn't). */
export function rayToPolygon(poly: readonly Point[], deg: number): number {
  const a = (deg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (p.x * ey - p.y * ex) / den;
    const u = (p.x * dy - p.y * dx) / den;
    // A little slack, so a ray through a corner exactly still hits it.
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t);
  }
  return best;
}

/** The band's middle line for this token: between the frame's edges, or round a picture frame's hole. */
export function decorationGeometry(doc: Pick<TokenDocument, 'shape' | 'frame' | 'size'>): DecorationGeometry {
  const squares = doc.size.squares;
  const img = doc.frame.kind === 'image' ? doc.frame.image : null;
  if (img) {
    const hole = nudgedHole(img.hole, img.nudge);
    return { squares, ringAt: (deg) => (rayToPolygon(hole, deg) + Math.min(1, img.outer)) / 2 };
  }
  const insets = computeInsets(doc);
  const hasFrame = doc.frame.style !== 'none' && insets.frameInner > insets.frameOuter;
  const inset = hasFrame ? (insets.frameOuter + insets.frameInner) / 2 : insets.image;
  const ring = shapePolygon(doc.shape, 1, inset);
  return { squares, ringAt: (deg) => rayToPolygon(ring, deg) };
}

/** Where a snap point is, and the way a decoration there turns so it faces outwards. */
export function snapPosition(place: SnapPoint, geo: DecorationGeometry): { x: number; y: number; facing: number } {
  const deg = SNAP_ANGLES[place];
  const r = geo.ringAt(deg);
  const a = (deg * Math.PI) / 180;
  // Pictures are drawn for the top (270°), so a decoration at `deg` turns by deg − 270.
  return { x: r * Math.cos(a), y: r * Math.sin(a), facing: normalise(deg + 90) };
}

/** The mirror image of a placement across the token's up-down middle line (left ↔ right). */
export function mirrorPlacement(p: Placement): Placement {
  return { x: -p.x, y: p.y, rotation: normalise(-p.rotation), flip: !p.flip, mirrored: true };
}

/** Every copy of a decoration to draw: itself, and its mirror image when mirroring is on. */
export function placements(d: Pick<Decoration, 'place' | 'x' | 'y' | 'rotation' | 'mirror' | 'flip'>, geo: DecorationGeometry): Placement[] {
  const base =
    d.place === 'free'
      ? { x: d.x, y: d.y, rotation: normalise(d.rotation), flip: d.flip, mirrored: false }
      : (() => {
          const s = snapPosition(d.place, geo);
          return { x: s.x, y: s.y, rotation: normalise(s.facing + d.rotation), flip: d.flip, mirrored: false };
        })();
  if (!d.mirror) return [base];
  const twin = mirrorPlacement(base);
  // Sitting on the middle line facing straight up or down, the twin would land on itself.
  const same = Math.abs(twin.x - base.x) < 1e-6 && Math.abs(normalise(twin.rotation - base.rotation)) < 1e-6;
  return same ? [base] : [base, twin];
}

/** The snap point within `reach` (token units) of `p`, if any. */
export function nearestSnap(p: Point, geo: DecorationGeometry, reach = 0.14): SnapPoint | null {
  let best: SnapPoint | null = null;
  let bestD = reach;
  for (const s of SNAP_POINTS) {
    const q = snapPosition(s, geo);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** An angle folded into -180…180. */
function normalise(deg: number): number {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180;
  return a === -180 ? 180 : a;
}

/** Height and width of a decoration, in token units. */
export function decorationSize(d: Pick<Decoration, 'kind' | 'size'> & Partial<Pick<Decoration, 'aspect'>>, squares: number): { w: number; h: number } {
  const h = d.size / squares;
  // A picture's own shape (v8); code-drawn ones have theirs in the catalogue.
  return { w: h * (d.kind === 'picture' && d.aspect ? d.aspect : decorationInfo(d.kind).aspect), h };
}

/** The four corners of a placed decoration's picture, in token units (for picking it on the canvas and its handles). */
export function decorationCorners(d: Pick<Decoration, 'kind' | 'size'> & Partial<Pick<Decoration, 'aspect'>>, p: Placement, squares: number): Point[] {
  const { w, h } = decorationSize(d, squares);
  const { anchor } = decorationInfo(d.kind);
  const a = (p.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const ax = p.flip ? 1 - anchor.x : anchor.x;
  return [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].map(([u, v]) => {
    const lx = (u! - ax) * w;
    const ly = (v! - anchor.y) * h;
    return { x: p.x + lx * cos - ly * sin, y: p.y + lx * sin + ly * cos };
  });
}

// ---- Drawing ----

/** Room round each picture for its outline, as a fraction of its height. */
const PAD = 0.06;
const bitmaps = new Map<string, CanvasImageSource>();

/** A decoration's picture at `heightPx` pixels high (plus padding), cached. */
function bitmap(d: Pick<Decoration, 'kind' | 'color'>, heightPx: number): { image: CanvasImageSource; w: number; h: number; pad: number } {
  const info = decorationInfo(d.kind);
  const h = Math.max(4, Math.round(heightPx));
  const w = Math.max(4, Math.round(h * info.aspect));
  const pad = Math.ceil(h * PAD);
  const key = `${d.kind}|${d.color}|${h}`;
  let image = bitmaps.get(key);
  if (!image) {
    const c = newCanvas(w + pad * 2, h + pad * 2);
    const ctx = c.getContext('2d') as Ctx;
    ctx.translate(pad, pad);
    ctx.scale(h / 100, h / 100);
    DECORATION_PAINTERS[d.kind](ctx, d.color, info.aspect * 100);
    image = c as CanvasImageSource;
    bitmaps.set(key, image);
    while (bitmaps.size > 120) bitmaps.delete(bitmaps.keys().next().value!);
  }
  return { image, w, h, pad };
}

const tinted = new WeakMap<object, Map<string, CanvasImageSource>>();

/** A picture decoration's picture, coloured with `color` when it is tinted (multiplied, so its dark outline stays dark), cached. */
function pictureBitmap(pic: RenderSource, color: string, tint: boolean): { image: CanvasImageSource; w: number; h: number; pad: number } {
  if (!tint) return { image: pic.image, w: pic.width, h: pic.height, pad: 0 };
  let byColor = tinted.get(pic.image as object);
  if (!byColor) tinted.set(pic.image as object, (byColor = new Map()));
  let image = byColor.get(color);
  if (!image) {
    const c = newCanvas(pic.width, pic.height);
    const ctx = c.getContext('2d') as Ctx;
    ctx.drawImage(pic.image, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, pic.width, pic.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(pic.image, 0, 0);
    image = c as CanvasImageSource;
    if (byColor.size > 8) byColor.clear();
    byColor.set(color, image);
  }
  return { image, w: pic.width, h: pic.height, pad: 0 };
}

/**
 * Draws every visible decoration (bottom of the list first). The context's
 * origin is the token centre and `R` its half-size in pixels. Picture
 * decorations (v8) come from `assets`; one still loading is skipped.
 */
export function drawDecorations(ctx: Ctx, doc: Pick<TokenDocument, 'decorations' | 'shape' | 'frame' | 'size'>, R: number, assets: AssetMap = new Map()): void {
  const geo = decorationGeometry(doc);
  for (const d of doc.decorations) {
    if (!d.visible || d.opacity <= 0) continue;
    const info = decorationInfo(d.kind);
    const { h } = decorationSize(d, geo.squares);
    const hPx = h * R;
    if (hPx < 1) continue;
    const pic = d.kind === 'picture' && d.image ? assets.get(pictureAssetId(d.image)) : undefined;
    if (d.kind === 'picture' && !pic) continue;
    const bmp = pic ? pictureBitmap(pic, d.color, d.tint) : bitmap(d, hPx);
    const scale = hPx / bmp.h;
    for (const p of placements(d, geo)) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, d.opacity);
      ctx.translate(p.x * R, p.y * R);
      ctx.rotate((p.rotation * Math.PI) / 180);
      if (p.flip) ctx.scale(-1, 1);
      ctx.scale(scale, scale);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp.image, -info.anchor.x * bmp.w - bmp.pad, -info.anchor.y * bmp.h - bmp.pad, bmp.w + bmp.pad * 2, bmp.h + bmp.pad * 2);
      ctx.restore();
    }
  }
}
