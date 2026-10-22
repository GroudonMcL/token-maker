// Layer 6 (DESIGN.md §6.4): foreground overlays, drawn over the art inside
// the frame's opening, each with its own opacity and blend mode. Foliage,
// smoke, mist and cobwebs are drawn by code with a seeded random layout, so
// a token looks the same every time and at every size. Each overlay is
// drawn once into its own canvas and reused until it or the size changes.

import type { BlendMode, OverlayLayer } from '../document/types';
import { newCanvas } from '../image/processedArt';
import { mix, rgba, shade } from './color';
import { seededRandom, tracePolygon, type Ctx } from './frameKit';
import { makeGradient } from './background';
import { boundingBox, type Point } from './shapes';

export const BLEND_OPS: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft-light': 'soft-light',
};

type Box = { minX: number; maxX: number; minY: number; maxY: number };

const cache = new Map<string, CanvasImageSource>();
const MAX_CACHED = 24;

/** Paints every visible overlay, bottom of the list first. */
export function drawOverlays(ctx: Ctx, overlays: readonly OverlayLayer[], clip: Point[], size: number): void {
  if (!clip.length) return;
  const box = boundingBox(clip);
  for (const o of overlays) {
    if (!o.visible || o.opacity <= 0) continue;
    const layer = overlayLayer(o, box, size);
    ctx.save();
    tracePolygon(ctx, clip);
    ctx.clip();
    ctx.globalAlpha = Math.min(1, o.opacity);
    ctx.globalCompositeOperation = BLEND_OPS[o.blend] ?? 'source-over';
    ctx.drawImage(layer, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

/** The overlay drawn on its own, at full strength, on a `size`×`size` canvas. */
function overlayLayer(o: OverlayLayer, box: Box, size: number): CanvasImageSource {
  // Only what changes the picture (not opacity, blend or visibility, which are applied when compositing).
  const key = JSON.stringify([o.kind, o.color, o.size, o.softness, o.angle, o.scale, o.seed, o.kind === 'gradient' ? o.gradient : 0, size, box.minX, box.maxX, box.minY, box.maxY]);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const c = newCanvas(size, size);
  const ctx = c.getContext('2d') as Ctx;
  ctx.translate(size / 2, size / 2);
  paintOverlay(ctx, o, box);
  cache.set(key, c as CanvasImageSource);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return c as CanvasImageSource;
}

/** Draws one overlay with the token centre at the origin. Exported for tests. */
export function paintOverlay(ctx: Ctx, o: OverlayLayer, box: Box): void {
  const rr = Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2;
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  const fillBox = () => ctx.fillRect(box.minX - 1, box.minY - 1, w + 2, h + 2);
  const random = seededRandom(0x9e37 + o.seed * 7919);
  const scale = o.scale / 100;
  /** Turns the canvas so "down" points at the overlay's side. */
  const faceSide = () => ctx.rotate(((o.angle - 90) * Math.PI) / 180);

  switch (o.kind) {
    case 'gradient': {
      ctx.fillStyle = makeGradient(ctx, o.gradient, box);
      fillBox();
      break;
    }
    case 'vignette': {
      const start = Math.max(0, rr * (1.05 - (o.size / 100) * 0.85));
      const end = start + rr * (0.08 + (o.softness / 100) * 0.9);
      const g = ctx.createRadialGradient(0, 0, start, 0, 0, end);
      g.addColorStop(0, rgba(o.color, 0));
      g.addColorStop(1, rgba(o.color, 1));
      ctx.fillStyle = g;
      fillBox();
      break;
    }
    case 'shadow': {
      faceSide();
      const depth = Math.max(1, 2 * rr * (o.size / 100));
      const g = ctx.createLinearGradient(0, rr * 1.42, 0, rr - depth);
      g.addColorStop(0, rgba(o.color, 1));
      g.addColorStop(Math.min(0.95, (1 - o.softness / 100) * 0.9 + 0.02), rgba(o.color, 1));
      g.addColorStop(1, rgba(o.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-rr * 1.5, -rr * 1.5, rr * 3, rr * 3);
      break;
    }
    case 'mist': {
      faceSide();
      const band = Math.max(1, 2 * rr * (o.size / 100));
      const base = ctx.createLinearGradient(0, rr * 1.42, 0, rr - band);
      base.addColorStop(0, rgba(o.color, 0.85));
      base.addColorStop(1, rgba(o.color, 0));
      ctx.fillStyle = base;
      ctx.fillRect(-rr * 1.5, -rr * 1.5, rr * 3, rr * 3);
      // Soft drifting banks along the band.
      for (let i = 0; i < 26; i++) {
        const x = (random() * 2.6 - 1.3) * rr;
        const y = rr - random() * band * 0.85;
        puff(ctx, x, y, rr * (0.12 + random() * 0.2) * scale, o.color, 0.35, o.softness, 2.4);
      }
      break;
    }
    case 'smoke': {
      const count = Math.round(4 + (o.size / 100) * 26);
      for (let i = 0; i < count; i++) {
        const x = (random() * 2 - 1) * rr;
        const y = (random() * 2 - 1) * rr;
        const r = rr * (0.12 + random() * 0.22) * scale;
        // A billow: a few puffs around one point.
        for (let k = 0; k < 4; k++) {
          const a = random() * Math.PI * 2;
          puff(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.4, r * (0.6 + random() * 0.5), o.color, 0.32, o.softness, 1.3);
        }
      }
      // Wisps.
      ctx.lineCap = 'round';
      for (let i = 0; i < Math.round(count / 3); i++) {
        const x = (random() * 2 - 1) * rr;
        const y = (random() * 2 - 1) * rr;
        ctx.strokeStyle = rgba(o.color, 0.18);
        ctx.lineWidth = rr * 0.035 * scale;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + rr * 0.2, y - rr * 0.25, x - rr * 0.15, y - rr * 0.4, x + rr * 0.1, y - rr * 0.6);
        ctx.stroke();
      }
      break;
    }
    case 'foliage':
      faceSide();
      foliage(ctx, o, rr, random, scale);
      break;
    case 'cobwebs':
      cobweb(ctx, o, rr, random, scale);
      break;
  }
}

/** A soft round (or wide, with `stretch`) blob of colour. */
function puff(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number, softness: number, stretch: number): void {
  if (r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(stretch, 1);
  const g = ctx.createRadialGradient(0, 0, r * (1 - Math.max(0.05, softness / 100)) * 0.9, 0, 0, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Leafy stems growing in from the bottom edge (the canvas is already turned to the overlay's side). */
function foliage(ctx: Ctx, o: OverlayLayer, rr: number, random: () => number, scale: number): void {
  const reach = 2 * rr * (o.size / 100);
  const leaf = rr * 0.075 * scale;
  const stems = Math.max(4, Math.round((2.6 * rr) / (leaf * 2.2)));
  for (const layer of [0, 1]) {
    for (let i = 0; i < stems; i++) {
      const x0 = -rr * 1.3 + (2.6 * rr * (i + random() * 0.8)) / stems;
      const y0 = rr * 1.1;
      const len = reach * (0.45 + random() * 0.7) * (layer ? 0.8 : 1);
      const lean = (random() - 0.5) * 0.9;
      const steps = Math.max(3, Math.round(len / (leaf * 0.9)));
      ctx.strokeStyle = shade(o.color, -0.55);
      ctx.lineWidth = Math.max(0.6, leaf * 0.12);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const tip = { x: x0 + lean * len, y: y0 - len };
      ctx.quadraticCurveTo(x0 + lean * len * 0.2, y0 - len * 0.6, tip.x, tip.y);
      ctx.stroke();
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        // Along the curve (close enough for leaf placement).
        const px = x0 + lean * len * (0.4 * t + 0.6 * t * t);
        const py = y0 - len * t;
        const side = k % 2 ? 1 : -1;
        const tone = layer ? shade(o.color, (random() - 0.3) * 0.5) : shade(o.color, -0.35 + random() * 0.15);
        drawLeaf(ctx, px, py, leaf * (1.1 - t * 0.5) * (0.8 + random() * 0.4), -Math.PI / 2 + side * (0.6 + random() * 0.5) + lean * 0.5, tone);
      }
    }
  }
}

function drawLeaf(ctx: Ctx, x: number, y: number, len: number, angle: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, -len * 0.35, 0, len * 0.35);
  g.addColorStop(0, shade(color, 0.25));
  g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.38, len * 1.6, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0);
  ctx.fill();
  ctx.strokeStyle = rgba(mix(color, '#000000', 0.5), 0.5);
  ctx.lineWidth = Math.max(0.4, len * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 1.4, 0);
  ctx.stroke();
  ctx.restore();
}

/** A web spun in the corner (or edge) the overlay's angle points to. */
function cobweb(ctx: Ctx, o: OverlayLayer, rr: number, random: () => number, scale: number): void {
  const a = (o.angle * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const k = rr / Math.max(Math.abs(ca), Math.abs(sa), 1e-6);
  const ox = ca * k;
  const oy = sa * k;
  const inward = a + Math.PI;
  const length = 2 * rr * (o.size / 100);
  const threads = 7;
  const spread = (110 * Math.PI) / 180;
  const ends: { x: number; y: number; dx: number; dy: number; len: number }[] = [];
  for (let i = 0; i < threads; i++) {
    const t = inward - spread / 2 + (spread * i) / (threads - 1) + (random() - 0.5) * 0.1;
    ends.push({ x: ox, y: oy, dx: Math.cos(t), dy: Math.sin(t), len: length * (0.8 + random() * 0.3) });
  }
  ctx.strokeStyle = rgba(o.color, 0.85);
  ctx.lineWidth = Math.max(0.6, rr * 0.0045);
  ctx.lineCap = 'round';
  for (const e of ends) {
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + e.dx * e.len, e.y + e.dy * e.len);
    ctx.stroke();
  }
  // Rings that sag back towards the corner between threads.
  const rings = Math.max(3, Math.round(8 / scale));
  for (let j = 1; j <= rings; j++) {
    const f = j / (rings + 0.5);
    ctx.lineWidth = Math.max(0.5, rr * 0.0035);
    ctx.beginPath();
    for (let i = 0; i < threads - 1; i++) {
      const p = ends[i]!;
      const q = ends[i + 1]!;
      const ax = p.x + p.dx * p.len * f;
      const ay = p.y + p.dy * p.len * f;
      const bx = q.x + q.dx * q.len * f;
      const by = q.y + q.dy * q.len * f;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const sag = 0.82 + random() * 0.08;
      if (i === 0) ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ox + (mx - ox) * sag, oy + (my - oy) * sag, bx, by);
    }
    ctx.stroke();
  }
}
