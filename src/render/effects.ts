// Layers 4, 7 and 10 (DESIGN.md §5, §6.8): the effect stack. Each effect is
// drawn where its placement says: behind the art and over the art inside the
// frame's opening, or on the border. Every effect is a function of
// (settings, size, seed, time) — see effectPainters.ts — so animation can be
// added later by passing a time other than 0. Each effect is made of one or
// more passes; a pass is drawn once into its own canvas and reused until its
// settings or the token's size change, then composited (with its blend mode
// and the effect's Intensity), so dragging Intensity never redraws anything.

import type { EffectLayer, EffectPlacement } from '../document/types';
import { blurImage } from '../image/filters';
import { newCanvas } from '../image/processedArt';
import { BLEND_OPS } from './overlays';
import { pictureAssetId } from './pictureLibrary';
import type { AssetMap, RenderSource } from './render';
import type { ShapeId } from './catalog';
import { PAINTERS, type Pass } from './effectPainters';
import { seededRandom, type Ctx } from './frameKit';
import { boundingBox, pointInPolygon, samplePerimeter, shapePolygon, type Point } from './shapes';

/** The token's geometry, in pixels, that effects grow from. */
export interface EffectArea {
  shape: ShapeId;
  /** Token half-size; the canvas origin is the token centre. */
  R: number;
  /** Pixels per "per square" unit (1 = half a grid square). */
  unit: number;
  /** Inset of the frame's opening (where the art is clipped) from the token edge. */
  opening: number;
  /** The frame band's edges, inset from the token edge (a thin band at the art's edge when there is no frame). */
  bandOuter: number;
  bandInner: number;
}

/** A point on the edge an effect grows from. */
export interface EdgePoint extends Point {
  /** Unit vector the effect grows towards (out of the token on the border, into the opening inside it). */
  nx: number;
  ny: number;
  /** 0 at the top of the token … 1 at the bottom. */
  low: number;
}

/**
 * Everything a painter needs: the effect's settings, the area in pixels,
 * seeded random numbers and the time (seconds; always 0 for now).
 */
export interface EffectScene {
  fx: EffectLayer;
  area: EffectArea;
  time: number;
  /** True on the border; false behind or over the art (inside the opening). */
  border: boolean;
  /** The effect's Size in pixels. */
  reach: number;
  /** Spread, 0…1. */
  spread: number;
  /** A random number generator for one part of the effect; the same salt always gives the same numbers. */
  random: (salt: number) => () => number;
  /** The outline things grow from: the frame's opening, or the middle of the band. */
  edgePolygon: Point[];
  /** `count` points evenly spaced along the edge. */
  edge: (count: number) => EdgePoint[];
  /** The point `t` (0…1, clockwise from the top) of the way round the edge. */
  at: (t: number) => EdgePoint;
  edgeLength: number;
  /** Bounding box of where the effect lives. */
  box: { minX: number; maxX: number; minY: number; maxY: number };
  /** A random point where the effect lives: inside the opening, or around the band. */
  scatter: (random: () => number) => Point;
  /** Adds the area the effect tints (the opening, or the frame band) to the current path, for a fill or clip with 'evenodd'. */
  traceArea: (ctx: Ctx) => void;
  /** The art's outline (opaque where the art is), for glows round a cut-out creature. Only inside the opening. */
  subject: CanvasImageSource | null;
  /** A picture effect's picture, when it has loaded. */
  picture: RenderSource | null;
}

/** Where the art is: a picture of it on its own, and a key that changes when it does. */
export interface Subject {
  image: CanvasImageSource;
  key: string;
}

/** Effects that need the art's outline when they're inside the opening. */
export const needsSubject = (fx: EffectLayer) => fx.visible && fx.kind === 'outerGlow' && fx.placement !== 'border';

const cache = new Map<string, CanvasImageSource>();
/** Pixels kept in cached passes (about 100 MB). */
const CACHE_PIXELS = 24_000_000;
let cachedPixels = 0;

function remember(key: string, layer: CanvasImageSource, pixels: number): void {
  if (pixels > CACHE_PIXELS / 4) return; // a big export: drawn fresh, not kept
  cache.set(key, layer);
  cachedPixels += pixels;
  while (cachedPixels > CACHE_PIXELS && cache.size) {
    const oldest = cache.keys().next().value!;
    const c = cache.get(oldest) as { width: number; height: number };
    cachedPixels -= c.width * c.height;
    cache.delete(oldest);
  }
}

/** Empties the pass cache (tests). */
export function clearEffectCache(): void {
  cache.clear();
  cachedPixels = 0;
}

/**
 * Paints every visible effect with this placement, bottom of the list first.
 * The context's origin is the token centre; `size` is the token's width.
 */
export function drawEffects(
  ctx: Ctx,
  effects: readonly EffectLayer[],
  placement: EffectPlacement,
  area: EffectArea,
  size: number,
  subject: Subject | null = null,
  time = 0,
  assets: AssetMap = NO_ASSETS,
): void {
  for (const fx of effects) {
    if (!fx.visible || fx.placement !== placement || fx.intensity <= 0) continue;
    drawEffect(ctx, fx, area, size, fx.kind === 'outerGlow' && placement !== 'border' ? subject : null, time, assets);
  }
}

const NO_ASSETS: AssetMap = new Map();

/** Paints one effect (whatever its placement says), with the origin at the token centre. */
export function drawEffect(ctx: Ctx, fx: EffectLayer, area: EffectArea, size: number, subject: Subject | null = null, time = 0, assets: AssetMap = NO_ASSETS): void {
  const picture = fx.kind === 'picture' && fx.image ? (assets.get(pictureAssetId(fx.image)) ?? null) : null;
  if (fx.kind === 'picture' && !picture) return; // still loading
  const scene = makeScene(fx, area, subject?.image ?? null, time, picture);
  const passes = PAINTERS[fx.kind](scene);
  // Blur (v8) is drawn into the cached layer, so cheap direct passes go through one too.
  const blurPx = Math.max(0, fx.blur) * area.unit;
  const strength = Math.min(1, Math.max(0, fx.intensity / 100));
  passes.forEach((pass, i) => {
    const alpha = strength * (pass.alpha ?? 1);
    if (alpha <= 0) return;
    ctx.save();
    if (pass.clip === 'area' || !scene.border) {
      ctx.beginPath();
      scene.traceArea(ctx);
      ctx.clip('evenodd');
    }
    ctx.globalAlpha = alpha;
    // A chosen blend mode (v8) replaces the effect's own; 'normal' keeps it.
    ctx.globalCompositeOperation = fx.blend !== 'normal' ? BLEND_OPS[fx.blend] : (pass.op ?? 'source-over');
    if (pass.direct && blurPx < 0.5) {
      // Cheap passes (a flat fill) are drawn straight on.
      pass.paint(ctx);
    } else {
      ctx.drawImage(passLayer(scene, pass, i, size, subject?.key ?? '', blurPx), -size / 2, -size / 2, size, size);
    }
    ctx.restore();
  });
}

function passLayer(scene: EffectScene, pass: Pass, index: number, size: number, subjectKey: string, blurPx: number): CanvasImageSource {
  const { fx, area } = scene;
  // Everything that changes the picture; not Intensity, blend mode or visibility, which apply when compositing.
  const extra = fx.kind === 'gradient' ? fx.gradient : fx.kind === 'picture' ? [fx.image, fx.layout, fx.tint] : 0;
  const key = JSON.stringify([fx.kind, fx.placement, fx.color, fx.size, fx.spread, fx.seed, fx.angle, fx.softness, extra, index, area, size, scene.time, subjectKey, Math.round(blurPx * 10)]);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const c = newCanvas(size, size);
  const lctx = c.getContext('2d') as Ctx;
  lctx.translate(size / 2, size / 2);
  lctx.save();
  pass.paint(lctx);
  lctx.restore();
  if (blurPx >= 0.5) blurLayer(c, size, blurPx);
  // On the border nothing may stop dead at the image's edge: fade out just before it.
  if (scene.border && pass.clip !== 'area') fadeAtSquareEdge(lctx, size, Math.max(2, area.unit * 0.12));
  remember(key, c as CanvasImageSource, size * size);
  return c as CanvasImageSource;
}

/** Blurring works on a copy at most this many pixels across, then is scaled back up: it's blurred anyway. */
const BLUR_SIDE = 1024;

/** Blurs a square layer in place by `sigma` pixels. */
function blurLayer(c: ReturnType<typeof newCanvas>, size: number, sigma: number): void {
  const k = Math.min(1, BLUR_SIDE / size);
  const w = Math.max(1, Math.round(size * k));
  const small = k < 1 ? newCanvas(w, w) : c;
  const sctx = small.getContext('2d') as Ctx;
  if (k < 1) sctx.drawImage(c as CanvasImageSource, 0, 0, w, w);
  const img = sctx.getImageData(0, 0, w, w);
  blurImage({ data: img.data, width: w, height: w }, sigma * k);
  sctx.putImageData(img, 0, 0);
  if (k < 1) {
    const ctx = c.getContext('2d') as Ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small as CanvasImageSource, 0, 0, size, size);
    ctx.restore();
  }
}

/** Fades a layer out over the last `fade` pixels (6 % of a square) before each side of the square. */
function fadeAtSquareEdge(ctx: Ctx, size: number, fade: number): void {
  const h = size / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  for (let side = 0; side < 4; side++) {
    ctx.save();
    ctx.rotate((side * Math.PI) / 2);
    const g = ctx.createLinearGradient(0, h - fade, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.restore();
  }
  ctx.restore();
}

function makeScene(fx: EffectLayer, area: EffectArea, subject: CanvasImageSource | null, time: number, picture: RenderSource | null = null): EffectScene {
  const border = fx.placement === 'border';
  const { shape, R } = area;
  const bandMid = (area.bandOuter + area.bandInner) / 2;
  const edgePolygon = shapePolygon(shape, R, border ? bandMid : area.opening);
  const opening = shapePolygon(shape, R, area.opening);
  const outer = shapePolygon(shape, R, area.bandOuter);
  const inner = shapePolygon(shape, R, area.bandInner);
  const box = boundingBox(border ? outer : opening);
  const height = Math.max(1, box.maxY - box.minY);
  // Inside the opening there's more room, so things reach further in than they stick out of the border.
  const reach = Math.max(0.5, fx.size * area.unit * (border ? 1 : 1.6));
  const edgeLength = edgePolygon.reduce((sum, p, i) => {
    const q = edgePolygon[(i + 1) % edgePolygon.length]!;
    return sum + Math.hypot(q.x - p.x, q.y - p.y);
  }, 0);

  const edge = (count: number): EdgePoint[] =>
    samplePerimeter(edgePolygon, Math.max(3, Math.round(count))).map((p) => {
      // samplePerimeter runs clockwise, so the inward normal is the direction of travel turned a quarter right.
      const inX = -Math.sin(p.angle);
      const inY = Math.cos(p.angle);
      const k = border ? -1 : 1;
      return { x: p.x, y: p.y, nx: inX * k, ny: inY * k, low: (p.y - box.minY) / height };
    });

  const at = (t: number): EdgePoint => {
    const p = pointAlong(edgePolygon, t);
    const k = border ? 1 : -1;
    return { x: p.x, y: p.y, nx: p.nx * k, ny: p.ny * k, low: (p.y - box.minY) / height };
  };

  const bandWidth = Math.max(1, area.bandInner - area.bandOuter);
  const scatter = (random: () => number): Point => {
    if (border) {
      // Around the band: anywhere across it and a little either side (more outside than in).
      const p = pointAlong(edgePolygon, random());
      const off = (random() - 0.35) * (bandWidth + reach);
      return { x: p.x + p.nx * off, y: p.y + p.ny * off };
    }
    for (let i = 0; i < 30; i++) {
      const pt = { x: box.minX + random() * (box.maxX - box.minX), y: box.minY + random() * height };
      if (pointInPolygon(pt, opening)) return pt;
    }
    return { x: 0, y: 0 };
  };

  const traceArea = (ctx: Ctx) => {
    for (const poly of border ? [outer, inner] : [opening]) {
      poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    }
  };

  return {
    fx,
    area,
    time,
    border,
    reach,
    spread: Math.min(1, Math.max(0, fx.spread / 100)),
    random: (salt) => seededRandom(0x51ed + fx.seed * 7919 + salt * 104729),
    edgePolygon,
    edge,
    at,
    edgeLength,
    box,
    scatter,
    traceArea,
    subject: border ? null : subject,
    picture,
  };
}

/** The point `t` (0…1) of the way round a closed polygon (clockwise), with its outward normal. */
function pointAlong(points: Point[], t: number): Point & { nx: number; ny: number } {
  const total = points.reduce((s, p, i) => {
    const q = points[(i + 1) % points.length]!;
    return s + Math.hypot(q.x - p.x, q.y - p.y);
  }, 0);
  let target = (((t % 1) + 1) % 1) * total;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (target <= len || i === points.length - 1) {
      const k = len ? Math.min(1, target / len) : 0;
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, nx: Math.sin(a), ny: -Math.cos(a) };
    }
    target -= len;
  }
  return { x: 0, y: 0, nx: 0, ny: -1 };
}
