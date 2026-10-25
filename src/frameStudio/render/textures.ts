// Texture layers (DESIGN.md §4.6): the procedural surfaces Token Maker's
// frames are made of, as layers with settings. Each painter is a
// re-implementation of the token-maker texture it is named after (in
// engine/legacy/finishes.ts, which can't be edited or imported from); at
// its default settings and seed it draws exactly what the original draws,
// and textures.test.ts checks that pixel for pixel. Painters that are lit
// turn with the stage's light, and are identical to the original at the top
// left (225°).

import { mix, rgba, shade, toHsl } from '../../render/color';
import { alongBand, atPoint, clipToBand, countFor, degreesAt, perimeterLength, seededRandom, wavyLine, type FrameGeometry } from '../../render/frameKit';
import { samplePerimeter, shapePolygon, type Point } from '../../render/shapes';
import { STAMPED_FLECK_LIGHT, STAMPED_MARBLE_LIGHT, STAMPED_OUTER, STAMPED_VEIN_LIGHT, stampedColour } from '../project/stamped';
import { DEFAULT_LIGHT, type TextureKind, type TextureLayer } from '../project/types';
import { bandWidthPx, insetAt, outlineAt, spacedAlong } from './band';
import { context2d, newCanvas, type Ctx } from './canvas';
import { lightAt, lightVector, turn, turnTable } from './light';
import { litFor, ringTable } from './paint';

export const TEXTURE_NAMES: Record<TextureKind, string> = {
  marble: 'Marble',
  hammered: 'Hammered metal',
  wear: 'Battle wear',
  wood: 'Wood grain',
  stone: 'Stone blocks',
  scatter: 'Stars (scatter)',
  rope: 'Rope',
  scales: 'Scales',
  cracks: 'Glowing cracks',
  veins: 'Veined marble (Stamped’s)',
  brushed: 'Brushed metal',
  woven: 'Basket weave',
  chainmail: 'Chainmail',
  rust: 'Rust',
  frost: 'Frost',
  bark: 'Bark',
  sparkle: 'Sparkles',
  crackle: 'Crackle glaze',
  knurl: 'Knurled grip',
};

/** How strongly a texture shows at a point (0–1); 1 everywhere unless it keeps to one side. */
export type Weight = (x: number, y: number) => number;
const everywhere: Weight = () => 1;

/**
 * The direction away from the light, scaled so that at the top-left light it
 * is exactly (1, 1): the originals offset dents and highlights by multiples
 * of (±1, ±1).
 */
function awayFromLight(light: number): Point {
  if (light === DEFAULT_LIGHT) return { x: 1, y: 1 };
  return turn({ x: 1, y: 1 }, ((light - DEFAULT_LIGHT) * Math.PI) / 180);
}

/** How dark a 360-entry colour table is at a point, 0 (lit) to 1 (darkest), as token-maker's marble judges it. */
export function darknessOf(table: string[]): Weight {
  const values = table.map((c) => Math.max(0, Math.min(1, (0.55 - toHsl(c).l) / 0.4)));
  return (x, y) => values[degreesAt(x, y)];
}

// ---- The painters. `g` is the part of the band the texture covers. ----

export interface MarbleOptions {
  base: string;
  seed: number;
  amount: number;
  scale: number;
  strength: number;
  /** Where the marbling goes (the original: the band's darker side). */
  weight: Weight;
}

/** Soft marbling and flecks (token-maker's `marble`). */
export function marble(ctx: Ctx, g: FrameGeometry, o: MarbleOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const n = countFor(g, w / (14 * o.amount));
  for (const p of alongBand(g, n)) {
    const across = (random() - 0.5) * w;
    const x = p.x - Math.sin(p.angle) * across;
    const y = p.y + Math.cos(p.angle) * across;
    if (random() > 0.25 + o.weight(x, y) * 0.75) continue;
    const r = w * (0.25 + random() * 0.45) * o.scale;
    ctx.fillStyle = random() < 0.5 ? rgba(shade(o.base, 0.35), 0.08 * o.strength) : rgba('#000000', 0.1 * o.strength);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.25 + random() * 0.2), p.angle + (random() - 0.5) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of alongBand(g, countFor(g, w / (50 * o.amount)))) {
    const across = (random() - 0.5) * w;
    const x = p.x - Math.sin(p.angle) * across;
    const y = p.y + Math.cos(p.angle) * across;
    if (random() > o.weight(x, y)) continue;
    ctx.fillStyle = random() < 0.6 ? rgba('#000000', 0.3 * o.strength) : rgba(shade(o.base, 0.5), 0.25 * o.strength);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.4, w * (0.006 + random() * 0.012) * o.scale), 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface HammerOptions {
  /** Colour of the dents and of the bright flecks on their lit side. */
  dark: string;
  bright: string;
  /** Dents per band width round the middle of the band. */
  density: number;
  /** Size of the dents. */
  grain: number;
  seed: number;
  light: number;
}

/** Hammered-metal pitting (token-maker's `hammerTexture`), lit from the stage's light. */
export function hammered(ctx: Ctx, g: FrameGeometry, o: HammerOptions): void {
  const w = bandWidthPx(g);
  const mid = shapePolygon(g.shape, g.R, g.outer + w / 2);
  const count = Math.round((perimeterLength(mid) / w) * o.density);
  const spacing = perimeterLength(mid) / Math.max(1, count);
  const random = seededRandom(o.seed);
  const away = awayFromLight(o.light);
  ctx.save();
  clipToBand(ctx, g);
  for (const p of samplePerimeter(mid, count)) {
    const along = (random() - 0.5) * spacing;
    const across = (random() - 0.5) * w * 1.05;
    const x = p.x + Math.cos(p.angle) * along - Math.sin(p.angle) * across;
    const y = p.y + Math.sin(p.angle) * along + Math.cos(p.angle) * across;
    const r = w * (0.035 + random() * 0.08) * o.grain;
    ctx.fillStyle = o.dark;
    ctx.beginPath();
    ctx.ellipse(x + away.x * r * 0.3, y + away.y * r * 0.3, r, r * (0.6 + random() * 0.4), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    if (random() < 0.7) {
      ctx.fillStyle = o.bright;
      ctx.beginPath();
      ctx.arc(x - away.x * r * 0.45, y - away.y * r * 0.45, r * (0.25 + random() * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export interface WearOptions {
  base: string;
  seed: number;
  amount: number;
  scale: number;
  strength: number;
  light: number;
}

/** Battle wear: dents lit on their far side, and scratches with a bright edge (token-maker's `battleWear`). */
export function wear(ctx: Ctx, g: FrameGeometry, o: WearOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const away = awayFromLight(o.light);
  // The lip of a dent catches the light on the side away from it.
  const lip = ((o.light - DEFAULT_LIGHT) * Math.PI) / 180;
  for (const p of alongBand(g, countFor(g, (w * 0.8) / o.amount))) {
    if (random() < 0.35) continue;
    const across = (random() - 0.5) * w * 0.8;
    const x = p.x - Math.sin(p.angle) * across;
    const y = p.y + Math.cos(p.angle) * across;
    const r = w * (0.08 + random() * 0.14) * o.scale;
    const dent = ctx.createRadialGradient(x - away.x * r * 0.3, y - away.y * r * 0.3, r * 0.1, x, y, r);
    dent.addColorStop(0, rgba('#000000', 0.5 * o.strength));
    dent.addColorStop(0.7, rgba('#000000', 0.2 * o.strength));
    dent.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = dent;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + random() * 0.4), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(o.base, 0.7), 0.45 * o.strength);
    ctx.lineWidth = Math.max(0.5, w * 0.025 * o.scale);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, lip, lip + Math.PI * 0.6);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  for (const p of alongBand(g, countFor(g, (w * 0.35) / o.amount))) {
    if (random() < 0.3) continue;
    const across = (random() - 0.5) * w;
    const x = p.x - Math.sin(p.angle) * across;
    const y = p.y + Math.cos(p.angle) * across;
    const a = p.angle + (random() - 0.5) * 2.2;
    const len = w * (0.15 + random() * 0.45) * o.scale;
    const bend = (random() - 0.5) * w * 0.12 * o.scale;
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    // The bright edge sits on the side away from the light.
    for (const [offset, colour, width] of [
      [w * 0.012, rgba(shade(o.base, 0.8), 0.55 * o.strength), 0.016],
      [0, rgba('#000000', 0.55 * o.strength), 0.014],
    ] as const) {
      const ox = away.x * offset;
      const oy = away.y * offset;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(0.5, w * width * o.scale);
      ctx.beginPath();
      ctx.moveTo(x - dx / 2 + ox, y - dy / 2 + oy);
      ctx.quadraticCurveTo(x - Math.sin(a) * bend + ox, y + Math.cos(a) * bend + oy, x + dx / 2 + ox, y + dy / 2 + oy);
      ctx.stroke();
    }
  }
}

export interface PlainOptions {
  base: string;
  seed: number;
  amount: number;
  scale: number;
  strength: number;
}

/** Wavy grain lines and knots (token-maker's Oak). */
export function woodGrain(ctx: Ctx, g: FrameGeometry, o: PlainOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const steps = countFor(g, w * 0.12);
  ctx.lineWidth = Math.max(0.6, w * 0.018 * o.scale);
  for (let k = 0, lines = Math.round(14 * o.amount); k < lines; k++) {
    const at = random();
    const freq = 3 + Math.floor(random() * 9);
    const phase = random() * Math.PI * 2;
    const amp = w * (0.02 + random() * 0.05) * o.scale;
    ctx.strokeStyle = random() < 0.6 ? rgba(shade(o.base, -0.65), 0.45 * o.strength) : rgba(shade(o.base, 0.4), 0.25 * o.strength);
    wavyLine(ctx, g, at, steps, (_i, t) => Math.sin(t * Math.PI * 2 * freq + phase) * amp);
    ctx.stroke();
  }
  // Knots.
  for (const p of alongBand(g, Math.max(1, Math.round(5 * o.amount)), 0.5)) {
    if (random() < 0.4) continue;
    atPoint(ctx, p, () => {
      for (let ring = 3; ring >= 1; ring--) {
        ctx.strokeStyle = rgba(shade(o.base, -0.7), 0.5 * o.strength);
        ctx.beginPath();
        ctx.ellipse((random() - 0.5) * w, (random() - 0.5) * w * 0.3, w * 0.09 * ring * o.scale, w * 0.04 * ring * o.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }
}

/** `n` points spaced evenly along a closed outline, from its first vertex (as the original's stone blocks are cut). */
function evenly(poly: Point[], n: number): Point[] {
  const total = perimeterLength(poly);
  const out: Point[] = [];
  let edge = 0;
  let walked = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / n) * total;
    for (;;) {
      const p = poly[edge];
      const q = poly[(edge + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (walked + len >= target - 1e-9 || edge === poly.length - 1) {
        const t = len ? (target - walked) / len : 0;
        out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
        break;
      }
      walked += len;
      edge++;
    }
  }
  return out;
}

/** Blocks of varied tone with mortar between them, then pitting (token-maker's Cobblestone). */
export function stoneBlocks(ctx: Ctx, g: FrameGeometry, o: PlainOptions & { light: number }): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const outer = shapePolygon(g.shape, g.R, g.outer - 1);
  const inner = shapePolygon(g.shape, g.R, g.inner + 1);
  const n = countFor(g, w * 1.15 * o.scale);
  const outerPts = evenly(outer, n);
  const innerPts = evenly(inner, n);
  const at = (pts: Point[], i: number) => pts[((i % n) + n) % n];
  if (outer.length && inner.length) {
    for (let i = 0; i < n; i++) {
      const a0 = at(outerPts, i);
      const a1 = at(outerPts, i + 1);
      const b0 = at(innerPts, i);
      const b1 = at(innerPts, i + 1);
      // Each block a slightly different tone.
      ctx.fillStyle = random() < 0.5 ? rgba(shade(o.base, 0.4), random() * 0.18 * o.strength) : rgba(shade(o.base, -0.5), random() * 0.22 * o.strength);
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(b0.x, b0.y);
      ctx.closePath();
      ctx.fill();
      // Mortar between blocks.
      ctx.strokeStyle = rgba(shade(o.base, -0.85), 0.8 * o.strength);
      ctx.lineWidth = w * 0.06;
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      const jx = (a0.x + b0.x) / 2 + (random() - 0.5) * w * 0.15;
      const jy = (a0.y + b0.y) / 2 + (random() - 0.5) * w * 0.15;
      ctx.lineTo(jx, jy);
      ctx.lineTo(b0.x, b0.y);
      ctx.stroke();
    }
  }
  hammered(ctx, g, {
    dark: rgba(shade(o.base, -0.7), 0.3 * o.strength),
    bright: rgba(shade(o.base, 0.5), 0.2 * o.strength),
    density: 12 * o.amount,
    grain: 0.6,
    seed: o.seed + 1,
    light: o.light,
  });
}

export interface ScatterOptions {
  /** The stars. */
  color: string;
  /** Soft haze behind them, or null. */
  haze: string | null;
  seed: number;
  amount: number;
  scale: number;
  strength: number;
}

/** Haze and scattered stars (token-maker's Starfield). */
export function scatter(ctx: Ctx, g: FrameGeometry, o: ScatterOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  for (const p of alongBand(g, countFor(g, w * 0.6))) {
    // Drawn or not, the haze takes its turn of the random numbers, so the stars stay put.
    const across = (random() - 0.5) * w;
    if (!o.haze) continue;
    ctx.fillStyle = rgba(o.haze, 0.18 * o.strength);
    ctx.beginPath();
    ctx.ellipse(p.x - Math.sin(p.angle) * across, p.y + Math.cos(p.angle) * across, w * 0.5, w * 0.2, p.angle, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of alongBand(g, countFor(g, (w * 0.07) / o.amount))) {
    const across = (random() - 0.5) * w;
    const r = Math.max(0.4, w * (0.008 + random() ** 3 * 0.04) * o.scale);
    ctx.fillStyle = rgba(o.color, Math.min(1, (0.4 + random() * 0.6) * o.strength));
    ctx.beginPath();
    ctx.arc(p.x - Math.sin(p.angle) * across, p.y + Math.cos(p.angle) * across, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Twisted strands, as on a rope (token-maker's `ropeStrands`), shaded by the stage's light. */
export function rope(ctx: Ctx, g: FrameGeometry, o: PlainOptions & { light: number }): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const s = o.scale;
  const fibres = Math.round(3 * o.amount);
  for (const p of alongBand(g, countFor(g, w * 0.32 * s))) {
    const l = lightAt(p, o.light);
    atPoint(ctx, p, () => {
      ctx.rotate(-0.6);
      const gradient = ctx.createLinearGradient(l.x * w * 0.3, l.y * w * 0.3, -l.x * w * 0.3, -l.y * w * 0.3);
      gradient.addColorStop(0, rgba(shade(o.base, 0.45), 0.55 * o.strength));
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, rgba('#000000', 0.45 * o.strength));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.2 * s, w * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(shade(o.base, -0.8), 0.6 * o.strength);
      ctx.lineWidth = Math.max(0.6, w * 0.025);
      ctx.beginPath();
      ctx.moveTo(w * 0.17 * s, -w * 0.8);
      ctx.lineTo(w * 0.17 * s, w * 0.8);
      ctx.stroke();
      // Fibres.
      ctx.strokeStyle = rgba(shade(o.base, 0.5), 0.2 * o.strength);
      ctx.lineWidth = Math.max(0.4, w * 0.01);
      for (let f = 0; f < fibres; f++) {
        const x = (random() - 0.5) * w * 0.25 * s;
        ctx.beginPath();
        ctx.moveTo(x, -w * 0.5);
        ctx.lineTo(x + w * 0.04, w * 0.5);
        ctx.stroke();
      }
    });
  }
}

/** Overlapping scales in staggered rows, `size` of the band across (token-maker's `drawScales`). */
export function scales(ctx: Ctx, g: FrameGeometry, o: { base: string; size: number; amount: number; strength: number }): void {
  const w = bandWidthPx(g);
  const r = w * o.size;
  let row = 0;
  for (let at = 0.15; at < 1.1; at += o.size * 1.5, row++) {
    const shift = row % 2 === 1;
    const pts = alongBand(g, countFor(g, (r * 1.6) / o.amount, at), at);
    pts.forEach((p, i) => {
      const q = pts[(i + (shift ? 1 : 0)) % pts.length];
      const x = shift ? (p.x + q.x) / 2 : p.x;
      const y = shift ? (p.y + q.y) / 2 : p.y;
      atPoint(ctx, { x, y, angle: p.angle }, () => {
        const gradient = ctx.createLinearGradient(0, -r, 0, r);
        gradient.addColorStop(0, rgba(shade(o.base, 0.45), 0.5 * o.strength));
        gradient.addColorStop(1, rgba(shade(o.base, -0.5), 0.35 * o.strength));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, r, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(shade(o.base, -0.8), 0.7 * o.strength);
        ctx.lineWidth = Math.max(0.6, w * 0.025 * (o.size / 0.2));
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, r, 0, Math.PI);
        ctx.stroke();
      });
    });
  }
}

/** Glowing wandering cracks (token-maker's Magma). */
export function cracks(ctx: Ctx, g: FrameGeometry, o: { color: string; seed: number; amount: number; scale: number; strength: number }): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const alpha = Math.min(1, 0.9 * o.strength);
  ctx.save();
  ctx.shadowColor = rgba(o.color, 1);
  ctx.shadowBlur = w * 0.3 * o.scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of alongBand(g, countFor(g, (w * 0.55) / o.amount))) {
    atPoint(ctx, p, () => {
      let x = (random() - 0.5) * w * 0.4;
      let y = -w * 0.5;
      let a = Math.PI / 2 + (random() - 0.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 6; i++) {
        a += (random() - 0.5) * 1.2;
        x += Math.cos(a) * w * 0.18 * o.scale;
        y += Math.sin(a) * w * 0.18 * o.scale;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(o.color, alpha);
      ctx.lineWidth = w * 0.05 * o.scale;
      ctx.stroke();
      ctx.strokeStyle = rgba(mix(o.color, '#fff3a0', 0.6), alpha);
      ctx.lineWidth = w * 0.018 * o.scale;
      ctx.stroke();
    });
  }
  ctx.restore();
}

export interface VeinOptions {
  color: string;
  seed: number;
  amount: number;
  scale: number;
  strength: number;
  /** How dark the band is at a point (0–1): marbling, flecks and veins keep to the dark parts. */
  weight: Weight;
}

/** Stamped's veins, flecks and marbling (token-maker's `stampedTexture`), in Stamped's colours moved to `color`. */
export function veins(ctx: Ctx, g: FrameGeometry, o: VeinOptions): void {
  const w = bandWidthPx(g);
  const mid = shapePolygon(g.shape, g.R, g.outer + w / 2);
  const length = perimeterLength(mid);
  const perBand = length / w;
  const random = seededRandom(o.seed);
  const dark = o.weight;
  const scatterAt = (p: { x: number; y: number; angle: number }) => {
    const along = (random() - 0.5) * (length / 40);
    const across = (random() - 0.5) * w * 1.05;
    return { x: p.x + Math.cos(p.angle) * along - Math.sin(p.angle) * across, y: p.y + Math.sin(p.angle) * along + Math.cos(p.angle) * across };
  };
  const k = o.strength;
  const marbleLight = rgba(stampedColour(STAMPED_MARBLE_LIGHT, o.color), 0.09 * k);
  const veinLight = rgba(stampedColour(STAMPED_VEIN_LIGHT, o.color), 0.22 * k);
  const fleckLight = rgba(stampedColour(STAMPED_FLECK_LIGHT, o.color), 0.25 * k);
  // Marbling: long soft patches lying along the band.
  for (const p of samplePerimeter(mid, Math.round(perBand * 14 * o.amount))) {
    const q = scatterAt(p);
    if (random() > dark(q.x, q.y) ** 2) continue;
    const r = w * (0.3 + random() * 0.5) * o.scale;
    ctx.fillStyle = random() < 0.5 ? marbleLight : rgba('#000000', 0.12 * k);
    ctx.beginPath();
    ctx.ellipse(q.x, q.y, r, r * (0.25 + random() * 0.2), p.angle + (random() - 0.5) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fine flecks.
  for (const p of samplePerimeter(mid, Math.round(perBand * 60 * o.amount))) {
    const q = scatterAt(p);
    if (random() > dark(q.x, q.y)) continue;
    const r = Math.max(0.4, w * (0.006 + random() * 0.012) * o.scale);
    ctx.fillStyle = random() < 0.6 ? rgba('#000000', 0.35 * k) : fleckLight;
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Veins: short wandering cracks with a lit edge.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of samplePerimeter(mid, Math.round(perBand * 18 * o.amount))) {
    const q = scatterAt(p);
    if (random() > dark(q.x, q.y) ** 1.5) continue;
    let a = random() * Math.PI * 2;
    const points = [q];
    for (let i = 0, n = 4 + Math.floor(random() * 6); i < n; i++) {
      a += (random() - 0.5) * 1.4;
      const last = points[points.length - 1];
      const step = w * (0.04 + random() * 0.07) * o.scale;
      points.push({ x: last.x + Math.cos(a) * step, y: last.y + Math.sin(a) * step });
    }
    for (const [offset, colour, width] of [
      [w * 0.014, veinLight, 0.014],
      [0, rgba('#000000', 0.5 * k), 0.016],
    ] as const) {
      ctx.beginPath();
      points.forEach((pt, i) => (i ? ctx.lineTo(pt.x - offset, pt.y - offset) : ctx.moveTo(pt.x - offset, pt.y - offset)));
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(0.6, w * width * o.scale);
      ctx.stroke();
    }
  }
}

/** A point `across` pixels in from a point on the band (inwards is to the right of the direction of travel). */
const inward = (p: { x: number; y: number; angle: number }, across: number) => ({ x: p.x - Math.sin(p.angle) * across, y: p.y + Math.cos(p.angle) * across });

type LitOptions = PlainOptions & { light: number };

/** Fine streaks along the band, lighter and darker, like brushed steel. */
export function brushed(ctx: Ctx, g: FrameGeometry, o: PlainOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  ctx.lineCap = 'round';
  for (const p of alongBand(g, countFor(g, (w * 0.05) / o.amount))) {
    const q = inward(p, (random() - 0.5) * w * 1.05);
    const len = w * (0.4 + random() * 1.6) * o.scale;
    const dx = (Math.cos(p.angle) * len) / 2;
    const dy = (Math.sin(p.angle) * len) / 2;
    ctx.strokeStyle = random() < 0.5 ? rgba(shade(o.base, 0.65), 0.14 * o.strength) : rgba('#000000', 0.12 * o.strength);
    ctx.lineWidth = Math.max(0.4, w * (0.006 + random() * 0.01) * o.scale);
    ctx.beginPath();
    ctx.moveTo(q.x - dx, q.y - dy);
    ctx.lineTo(q.x + dx, q.y + dy);
    ctx.stroke();
  }
}

/** Strands woven over and under, in rows across the band. */
export function woven(ctx: Ctx, g: FrameGeometry, o: LitOptions): void {
  const w = bandWidthPx(g);
  const rows = Math.max(1, Math.round(3 / o.scale));
  const cell = w / rows;
  const random = seededRandom(o.seed);
  const dark = rgba('#000000', Math.min(1, 0.35 * o.strength));
  for (let r = 0; r < rows; r++) {
    const at = (r + 0.5) / rows;
    alongBand(g, countFor(g, cell, at), at).forEach((p, i) => {
      const l = lightAt(p, o.light);
      atPoint(ctx, p, () => {
        const along = (i + r) % 2 === 0;
        ctx.fillStyle = dark;
        ctx.fillRect(-cell / 2, -cell / 2, cell, cell);
        for (let k = -1; k <= 1; k++) {
          // Each strand a little lighter or darker.
          const tone = 0.8 + random() * 0.4;
          const [x, y, sw, sh] = along ? [-cell / 2, (k * cell) / 3 - cell / 7, cell, (cell * 2) / 7] : [(k * cell) / 3 - cell / 7, -cell / 2, (cell * 2) / 7, cell];
          const gradient = ctx.createLinearGradient(l.x * cell * 0.5, l.y * cell * 0.5, -l.x * cell * 0.5, -l.y * cell * 0.5);
          gradient.addColorStop(0, rgba(shade(o.base, 0.45), Math.min(1, 0.55 * o.strength * tone)));
          gradient.addColorStop(1, rgba(shade(o.base, -0.3), Math.min(1, 0.5 * o.strength * tone)));
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, sw, sh);
        }
      });
    });
  }
}

/** Rows of interlinked rings, lit on the side facing the light. */
export function chainmail(ctx: Ctx, g: FrameGeometry, o: LitOptions): void {
  const w = bandWidthPx(g);
  const rows = Math.max(2, Math.round(3 / o.scale));
  const r = (w / rows) * 0.6;
  const l = lightVector(o.light);
  const towards = Math.atan2(l.y, l.x);
  const random = seededRandom(o.seed);
  for (let row = 0; row < rows; row++) {
    const at = (row + 0.5) / rows;
    const outline = outlineAt(g, at);
    const n = Math.max(3, Math.round((perimeterLength(outline) / (r * 1.3)) * o.amount));
    for (const p of spacedAlong(outline, n, row % 2 ? 0.5 : 0)) {
      ctx.strokeStyle = rgba('#000000', Math.min(1, 0.4 * o.strength));
      ctx.lineWidth = r * 0.34;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // Each ring catches the light a little differently.
      ctx.strokeStyle = rgba(shade(o.base, 0.55), Math.min(1, (0.4 + random() * 0.4) * o.strength));
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, towards - 1, towards + 1);
      ctx.stroke();
    }
  }
}

/** Patches of rust in clusters, with pits and bright specks. `base` is the rust's colour. */
export function rust(ctx: Ctx, g: FrameGeometry, o: PlainOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  for (const p of alongBand(g, countFor(g, (w * 0.5) / o.amount))) {
    if (random() < 0.3) continue;
    const c = inward(p, (random() - 0.5) * w);
    for (let k = 0, n = 3 + Math.floor(random() * 4); k < n; k++) {
      const r = w * (0.08 + random() * 0.18) * o.scale;
      ctx.fillStyle = rgba(random() < 0.5 ? o.base : shade(o.base, -0.4), Math.min(1, (0.12 + random() * 0.18) * o.strength));
      ctx.beginPath();
      ctx.ellipse(c.x + (random() - 0.5) * w * 0.5 * o.scale, c.y + (random() - 0.5) * w * 0.5 * o.scale, r, r * (0.6 + random() * 0.4), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const p of alongBand(g, countFor(g, (w * 0.1) / o.amount))) {
    const c = inward(p, (random() - 0.5) * w);
    ctx.fillStyle = random() < 0.6 ? rgba(shade(o.base, -0.7), Math.min(1, 0.4 * o.strength)) : rgba(mix(o.base, '#ffb060', 0.5), Math.min(1, 0.35 * o.strength));
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(0.4, w * (0.01 + random() * 0.02) * o.scale), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Frost: a faint haze and branching ice crystals growing in from both edges. `base` is the ice's colour. */
export function frost(ctx: Ctx, g: FrameGeometry, o: PlainOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  for (const p of alongBand(g, countFor(g, w * 0.5))) {
    const c = inward(p, (random() - 0.5) * w);
    ctx.fillStyle = rgba(o.base, Math.min(1, 0.07 * o.strength));
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, w * 0.45, w * 0.22, p.angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(o.base, Math.min(1, 0.6 * o.strength));
  const branch = (x: number, y: number, a: number, len: number, depth: number) => {
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    ctx.lineWidth = Math.max(0.4, w * 0.012 * o.scale * (depth + 1) * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) return;
    for (const t of [0.35, 0.65]) {
      const bx = x + Math.cos(a) * len * t;
      const by = y + Math.sin(a) * len * t;
      for (const side of [-1, 1]) branch(bx, by, a + side * (0.6 + random() * 0.3), len * (0.3 + random() * 0.2), depth - 1);
    }
  };
  for (const p of alongBand(g, countFor(g, (w * 0.3) / o.amount))) {
    const fromOuter = random() < 0.5;
    const start = inward(p, (fromOuter ? -0.5 : 0.5) * w);
    const a = p.angle + (fromOuter ? Math.PI / 2 : -Math.PI / 2) + (random() - 0.5) * 0.9;
    branch(start.x, start.y, a, w * (0.25 + random() * 0.35) * o.scale, 2);
  }
}

/** Bark: deep, rough fissures running along the band with a lit edge, and short cracks across. */
export function bark(ctx: Ctx, g: FrameGeometry, o: LitOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const l = lightVector(o.light);
  const steps = countFor(g, w * 0.08);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let k = 0, ridges = Math.max(2, Math.round(6 * o.amount)); k < ridges; k++) {
    const at = (k + 0.5) / ridges + (random() - 0.5) * 0.06;
    let off = 0;
    const pts = alongBand(g, steps, at).map((p) => {
      off = off * 0.85 + (random() - 0.5) * w * 0.05 * o.scale;
      return inward(p, off);
    });
    const width = w * (0.03 + random() * 0.03) * o.scale;
    const trace = (dx: number, dy: number) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)));
      ctx.closePath();
    };
    trace(l.x * width * 0.6, l.y * width * 0.6);
    ctx.strokeStyle = rgba(shade(o.base, 0.45), Math.min(1, 0.25 * o.strength));
    ctx.lineWidth = width * 0.5;
    ctx.stroke();
    trace(0, 0);
    ctx.strokeStyle = rgba(shade(o.base, -0.75), Math.min(1, 0.6 * o.strength));
    ctx.lineWidth = width;
    ctx.stroke();
  }
  for (const p of alongBand(g, countFor(g, (w * 0.45) / o.amount))) {
    const a = inward(p, (random() - 0.5) * w);
    const len = w * (0.1 + random() * 0.25) * o.scale;
    const turnBy = p.angle + Math.PI / 2 + (random() - 0.5) * 0.8;
    ctx.strokeStyle = rgba(shade(o.base, -0.7), Math.min(1, 0.45 * o.strength));
    ctx.lineWidth = Math.max(0.5, w * 0.02 * o.scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + Math.cos(turnBy) * len, a.y + Math.sin(turnBy) * len);
    ctx.stroke();
  }
}

/** Twinkling four-pointed sparkles and glints. `base` is their colour. */
export function sparkle(ctx: Ctx, g: FrameGeometry, o: PlainOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  for (const p of alongBand(g, countFor(g, (w * 0.3) / o.amount))) {
    const c = inward(p, (random() - 0.5) * w * 0.9);
    const r = w * (0.05 + random() ** 2 * 0.16) * o.scale;
    const alpha = Math.min(1, (0.5 + random() * 0.5) * o.strength);
    ctx.save();
    ctx.shadowColor = rgba(o.base, alpha);
    ctx.shadowBlur = r * 0.9;
    ctx.fillStyle = rgba(o.base, alpha);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      const rr = i % 2 ? r * 0.16 : r;
      ctx.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const p of alongBand(g, countFor(g, (w * 0.08) / o.amount))) {
    const c = inward(p, (random() - 0.5) * w);
    ctx.fillStyle = rgba(o.base, Math.min(1, (0.3 + random() * 0.5) * o.strength));
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(0.4, w * (0.006 + random() * 0.012) * o.scale), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A network of fine cracks, like an old glaze, with a lit edge. */
export function crackle(ctx: Ctx, g: FrameGeometry, o: LitOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  const l = lightVector(o.light);
  const pts = alongBand(g, countFor(g, (w * 0.3 * o.scale) / o.amount) * 2).map((p) => inward(p, (random() - 0.5) * w * 1.1));
  const n = pts.length;
  const done = new Set<string>();
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    // Its two nearest neighbours among the points close by along the band.
    const near: { j: number; d: number }[] = [];
    for (let k = -12; k <= 12; k++) {
      const j = (((i + k) % n) + n) % n;
      if (j !== i) near.push({ j, d: Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) });
    }
    near.sort((a, b) => a.d - b.d);
    for (const { j, d } of near.slice(0, 3)) {
      const key = i < j ? `${i}|${j}` : `${j}|${i}`;
      if (done.has(key)) continue;
      done.add(key);
      const a = pts[i];
      const b = pts[j];
      const bend = (random() - 0.5) * d * 0.35;
      const mx = (a.x + b.x) / 2 - ((b.y - a.y) / (d || 1)) * bend;
      const my = (a.y + b.y) / 2 + ((b.x - a.x) / (d || 1)) * bend;
      for (const [dx, dy, colour, width] of [
        [-l.x, -l.y, rgba(shade(o.base, 0.5), Math.min(1, 0.25 * o.strength)), 0.01],
        [0, 0, rgba(shade(o.base, -0.8), Math.min(1, 0.55 * o.strength)), 0.012],
      ] as const) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(0.4, w * width);
        ctx.beginPath();
        ctx.moveTo(a.x + dx, a.y + dy);
        ctx.lineTo(mx + dx, my + dy);
        ctx.lineTo(b.x + dx, b.y + dy);
        ctx.stroke();
      }
    }
  }
}

/** A diamond knurl, like the grip of a tool: crossing diagonal grooves with a lit edge. */
export function knurl(ctx: Ctx, g: FrameGeometry, o: LitOptions): void {
  const w = bandWidthPx(g);
  const random = seededRandom(o.seed);
  for (const p of alongBand(g, countFor(g, (w * 0.16 * o.scale) / o.amount))) {
    const l = lightAt(p, o.light);
    atPoint(ctx, p, () => {
      for (const dir of [1, -1]) {
        // Worn a little more in some grooves than others.
        const depth = 0.75 + random() * 0.5;
        for (const [dx, dy, colour, width] of [
          [l.x * w * 0.02, l.y * w * 0.02, rgba(shade(o.base, 0.55), Math.min(1, 0.3 * o.strength * depth)), 0.016],
          [0, 0, rgba('#000000', Math.min(1, 0.38 * o.strength * depth)), 0.03],
        ] as const) {
          ctx.strokeStyle = colour;
          ctx.lineWidth = Math.max(0.5, w * width * o.scale);
          ctx.beginPath();
          ctx.moveTo(-dir * w * 0.55 + dx, -w * 0.55 + dy);
          ctx.lineTo(dir * w * 0.55 + dx, w * 0.55 + dy);
          ctx.stroke();
        }
      }
    });
  }
}

// ---- The layer ----

/** The marbling's darker side, from the band lit the usual way in the texture's colour, turned to the light. */
function marbleWeight(layer: TextureLayer, light: number): Weight {
  const band = litFor(layer.color, 0.85, 0.8).band;
  if (layer.where === 'everywhere') return everywhere;
  return darknessOf(turnTable(band, layer.where === 'shaded' ? light : light + 180));
}

const stampedTables = new Map<string, string[]>();

/** Veined marble's darker side: where Stamped's colours (moved to the texture's colour) are dark, turned to the light. */
function veinWeight(layer: TextureLayer, light: number): Weight {
  if (layer.where === 'everywhere') return everywhere;
  let table = stampedTables.get(layer.color);
  if (!table) {
    table = ringTable(STAMPED_OUTER.map(([angle, c]) => ({ angle, color: stampedColour(c, layer.color) })));
    if (stampedTables.size > 32) stampedTables.clear();
    stampedTables.set(layer.color, table);
  }
  return darknessOf(turnTable(table, layer.where === 'shaded' ? light : light + 180));
}

/** Fades a picture towards one side of the light: 'shaded' keeps the side away from it, 'lit' the side facing it. */
function fadeToSide(ctx: Ctx, size: number, light: number, side: 'shaded' | 'lit'): void {
  const image = ctx.getImageData(0, 0, size, size);
  const d = image.data;
  const l = lightVector(light);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    const dy = y + 0.5 - c;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4 + 3;
      if (d[i] === 0) continue;
      const dx = x + 0.5 - c;
      // Cosine of the angle between the point (seen from the centre) and the light.
      const cos = (dx * l.x + dy * l.y) / (Math.hypot(dx, dy) || 1);
      const k = side === 'shaded' ? (1 - cos) / 2 : (1 + cos) / 2;
      d[i] = Math.round(d[i] * Math.min(1, k * 1.25));
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintKind(ctx: Ctx, g: FrameGeometry, layer: TextureLayer, light: number): void {
  const { color: base, seed, amount, scale, strength } = layer;
  switch (layer.kind) {
    case 'marble':
      return marble(ctx, g, { base, seed, amount, scale, strength, weight: marbleWeight(layer, light) });
    case 'hammered':
      return hammered(ctx, g, {
        dark: rgba(shade(base, -0.6), Math.min(1, 0.3 * strength)),
        bright: rgba(shade(base, 0.5), Math.min(1, 0.22 * strength)),
        density: 8 * amount,
        grain: scale,
        seed,
        light,
      });
    case 'wear':
      return wear(ctx, g, { base, seed, amount, scale, strength, light });
    case 'wood':
      return woodGrain(ctx, g, { base, seed, amount, scale, strength });
    case 'stone':
      return stoneBlocks(ctx, g, { base, seed, amount, scale, strength, light });
    case 'scatter':
      return scatter(ctx, g, { color: base, haze: layer.color2, seed, amount, scale, strength });
    case 'rope':
      return rope(ctx, g, { base, seed, amount, scale, strength, light });
    case 'scales':
      return scales(ctx, g, { base, size: 0.3 * scale, amount, strength });
    case 'cracks':
      return cracks(ctx, g, { color: base, seed, amount, scale, strength });
    case 'veins':
      return veins(ctx, g, { color: base, seed, amount, scale, strength, weight: veinWeight(layer, light) });
    case 'brushed':
      return brushed(ctx, g, { base, seed, amount, scale, strength });
    case 'woven':
      return woven(ctx, g, { base, seed, amount, scale, strength, light });
    case 'chainmail':
      return chainmail(ctx, g, { base, seed, amount, scale, strength, light });
    case 'rust':
      return rust(ctx, g, { base, seed, amount, scale, strength });
    case 'frost':
      return frost(ctx, g, { base, seed, amount, scale, strength });
    case 'bark':
      return bark(ctx, g, { base, seed, amount, scale, strength, light });
    case 'sparkle':
      return sparkle(ctx, g, { base, seed, amount, scale, strength });
    case 'crackle':
      return crackle(ctx, g, { base, seed, amount, scale, strength, light });
    case 'knurl':
      return knurl(ctx, g, { base, seed, amount, scale, strength, light });
  }
}

/** Draws a texture layer, clipped to the part of the band it covers. `size` is the picture's size in pixels. */
export function drawTexture(ctx: Ctx, layer: TextureLayer, g0: FrameGeometry, light: number, size: number): void {
  const lo = Math.min(layer.from, layer.to);
  const hi = Math.max(layer.from, layer.to);
  const g = { ...g0, outer: Math.max(0, insetAt(g0, lo)), inner: insetAt(g0, hi) };
  if (g.inner <= g.outer || layer.amount <= 0 || layer.strength <= 0) return;
  const paint = (c: Ctx) => {
    c.save();
    clipToBand(c, g);
    paintKind(c, g, layer, light);
    c.restore();
  };
  // Marble and veins keep to a side by themselves (as the originals do); the others are faded towards it.
  if (layer.where === 'everywhere' || layer.kind === 'marble' || layer.kind === 'veins') return paint(ctx);
  const own = newCanvas(size, size);
  const octx = context2d(own);
  octx.translate(size / 2, size / 2);
  paint(octx);
  fadeToSide(octx, size, light, layer.where);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(own as CanvasImageSource, 0, 0);
  ctx.restore();
}
