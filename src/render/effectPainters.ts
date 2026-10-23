// Every effect (DESIGN.md §6.8) as a function of (settings, size, seed,
// time): a painter takes an EffectScene — the effect's settings, the token's
// geometry in pixels, seeded random numbers and the time — and returns the
// passes to draw. Nothing here reads anything else, so an effect looks the
// same every time and at every size. Time is always 0 for now; it is used
// where animation would move things (flames flicker, embers rise, sparkles
// twinkle, lightning re-strikes), so animation can be added later without
// rewriting these.

import { OVERLAY_BASE_SIZE } from '../document/defaults';
import type { EffectKind, EffectLayer } from '../document/types';
import { newCanvas } from '../image/processedArt';
import { mix, rgba, shade } from './color';
import type { EdgePoint, EffectScene } from './effects';
import { paintOverlay, type OverlayKind, type OverlayParams } from './overlays';
import { effectPicture } from './pictureLibrary';
import type { RenderSource } from './render';
import { tracePolygon, type Ctx } from './frameKit';
import { shapePolygon, type Point } from './shapes';

/** One drawing step of an effect. */
export interface Pass {
  paint: (ctx: Ctx) => void;
  /** How it mixes with what's under it (default: normal). */
  op?: GlobalCompositeOperation;
  /** Multiplies the effect's Intensity. */
  alpha?: number;
  /**
   * 'area': kept inside the area it tints (the opening, or the frame band on
   * the border). Otherwise inside the opening, or anywhere in the square on
   * the border.
   */
  clip?: 'area';
  /** Draw straight onto the token instead of through a cached layer (cheap flat fills). */
  direct?: boolean;
}

export type Painter = (s: EffectScene) => Pass[];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const UP: Point = { x: 0, y: -1 };

/**
 * How much of an edge point an effect covers, 0…1. Spread 100 % goes all
 * the way round; less keeps to the bottom, as rising things (fire, mist)
 * would.
 */
function coverage(s: EffectScene, low: number): number {
  const threshold = 1 - s.spread * 1.1;
  return clamp01((low - threshold) / 0.25 + 0.5);
}

/** A random point, more often near the bottom. */
function lowPoint(s: EffectScene, random: () => number): Point {
  const a = s.scatter(random);
  const b = s.scatter(random);
  return a.y > b.y ? a : b;
}

/** Points on the edge with how much each is covered, skipping uncovered ones. */
function coveredEdge(s: EffectScene, spacing: number): (EdgePoint & { w: number })[] {
  return s
    .edge(s.edgeLength / Math.max(1, spacing))
    .map((p) => ({ ...p, w: coverage(s, p.low) }))
    .filter((p) => p.w > 0.04);
}

function normalize(v: Point): Point {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/** The way flames, mist and smoke go: out from the edge, bent upwards. */
function rising(s: EffectScene, p: EdgePoint, lift: number): Point {
  return normalize({ x: p.nx * (s.border ? 1 : 0.45) + UP.x * lift, y: p.ny * (s.border ? 1 : 0.45) + UP.y * lift });
}

/** Draws only the blurred shadow of `draw`: the shape itself is drawn far off the canvas. */
function shadowOnly(ctx: Ctx, s: EffectScene, color: string, blur: number, draw: (c: Ctx) => void): void {
  const far = s.area.R * 8 + blur * 4;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(0.5, blur);
  ctx.shadowOffsetX = far;
  ctx.translate(-far, 0);
  draw(ctx);
  ctx.restore();
}

/** Traces a rectangle well beyond the token (for "everything but" fills). */
function traceBeyond(ctx: Ctx, s: EffectScene): void {
  const r = s.area.R * 3;
  ctx.moveTo(-r, -r);
  ctx.lineTo(r, -r);
  ctx.lineTo(r, r);
  ctx.lineTo(-r, r);
  ctx.closePath();
}

/**
 * A glow along the edge: inside the opening it shines in from the frame;
 * on the border it lights the band and spills off it both ways.
 */
function edgeGlow(ctx: Ctx, s: EffectScene, color: string, blur: number, width = 0): void {
  if (s.border) {
    const band = Math.max(1, s.area.bandInner - s.area.bandOuter);
    shadowOnly(ctx, s, color, blur, (c) => {
      tracePolygon(c, s.edgePolygon);
      c.lineWidth = band + width * 2;
      c.lineJoin = 'round';
      c.strokeStyle = '#000';
      c.stroke();
    });
    return;
  }
  for (let i = 0; i < 2; i++) {
    shadowOnly(ctx, s, color, blur, (c) => {
      c.beginPath();
      traceBeyond(c, s);
      s.traceArea(c);
      c.fillStyle = '#000';
      c.fill('evenodd');
      if (width > 0) {
        c.beginPath();
        s.traceArea(c);
        c.lineWidth = width * 2;
        c.lineJoin = 'round';
        c.strokeStyle = '#000';
        c.stroke();
      }
    });
  }
}

/** A soft round blob, stretched sideways by `stretch`. */
function puff(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number, stretch = 1, angle = 0): void {
  if (r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(stretch, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.55, rgba(color, alpha * 0.6));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A glowing dot: a soft halo and a bright core. */
function spark(ctx: Ctx, x: number, y: number, r: number, color: string, core: string): void {
  puff(ctx, x, y, r * 3.2, color, 0.45);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A four-pointed star glint. */
function glint(ctx: Ctx, x: number, y: number, r: number, color: string, angle = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const waist = r * 0.16;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const b = a + Math.PI / 4;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(b) * waist, Math.sin(b) * waist);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, rgba(color, 1));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fill();
  puff(ctx, 0, 0, r * 0.55, color, 0.5);
  ctx.restore();
}

/** A jagged line from a to b (midpoint displacement), as a list of points. */
function jagged(a: Point, b: Point, rough: number, random: () => number, depth = 5): Point[] {
  let pts = [a, b];
  let amount = rough;
  for (let d = 0; d < depth; d++) {
    const next: Point[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const off = (random() * 2 - 1) * amount;
      next.push({ x: (p.x + q.x) / 2 + ((-(q.y - p.y)) / len) * off, y: (p.y + q.y) / 2 + ((q.x - p.x) / len) * off }, q);
    }
    pts = next;
    amount *= 0.55;
  }
  return pts;
}

function strokePoints(ctx: Ctx, pts: Point[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
}

function heart(ctx: Ctx, x: number, y: number, size: number, angle: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const k = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, k * 0.9);
  ctx.bezierCurveTo(-k * 1.4, -k * 0.1, -k * 0.75, -k * 1.15, 0, -k * 0.45);
  ctx.bezierCurveTo(k * 0.75, -k * 1.15, k * 1.4, -k * 0.1, 0, k * 0.9);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -k, 0, k);
  g.addColorStop(0, shade(color, 0.35));
  g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g;
  ctx.shadowColor = rgba(color, 0.8);
  ctx.shadowBlur = size * 0.35;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(0.6, size * 0.05);
  ctx.strokeStyle = rgba(shade(color, -0.55), 0.8);
  ctx.stroke();
  puff(ctx, -k * 0.38, -k * 0.38, k * 0.3, '#ffffff', 0.75);
  ctx.restore();
}

/** An irregular blob, like a splash. */
function blob(ctx: Ctx, x: number, y: number, r: number, random: () => number, points = 14): void {
  ctx.beginPath();
  const radii = Array.from({ length: points }, () => r * (0.75 + random() * 0.4));
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const b = ((i - 0.5) / points) * Math.PI * 2;
    const rr = radii[i % points]!;
    const prev = radii[(i + points - 1) % points]!;
    const mid = ((rr + prev) / 2) * 1.04;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.quadraticCurveTo(x + Math.cos(b) * mid, y + Math.sin(b) * mid, x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// ---- Glows ----

const outerGlow: Painter = (s) => {
  const { fx, reach, spread } = s;
  const blur = reach * (1 - spread * 0.6);
  const choke = reach * spread * 0.55;
  return [
    {
      paint: (ctx) => {
        if (s.border) {
          const outline = shapePolygon(s.area.shape, s.area.R, s.area.bandOuter);
          for (let i = 0; i < 2; i++) {
            shadowOnly(ctx, s, fx.color, blur, (c) => {
              tracePolygon(c, outline);
              c.fillStyle = '#000';
              c.fill();
              if (choke > 0) {
                c.lineWidth = choke * 2;
                c.lineJoin = 'round';
                c.strokeStyle = '#000';
                c.stroke();
              }
            });
          }
          // Only outside the token.
          ctx.globalCompositeOperation = 'destination-out';
          tracePolygon(ctx, outline);
          ctx.fill();
          return;
        }
        // Inside the opening: a halo round the art's own outline (a cut-out creature).
        const subject = s.subject;
        if (!subject) return;
        const R = s.area.R;
        const around = (c: Ctx) => {
          c.drawImage(subject, -R, -R, R * 2, R * 2);
          if (choke > 0) {
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              c.drawImage(subject, -R + Math.cos(a) * choke, -R + Math.sin(a) * choke, R * 2, R * 2);
            }
          }
        };
        for (let i = 0; i < 2; i++) {
          // The colour comes from the shadow; the art's own colours are drawn far away.
          shadowOnly(ctx, s, fx.color, blur, around);
        }
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(subject, -R, -R, R * 2, R * 2);
      },
    },
  ];
};

const innerGlow: Painter = (s) => [
  {
    clip: 'area',
    paint: (ctx) => {
      const blur = s.reach * (1 - s.spread * 0.6);
      const choke = s.reach * s.spread * 0.55;
      for (let i = 0; i < 2; i++) {
        shadowOnly(ctx, s, s.fx.color, blur, (c) => {
          c.beginPath();
          traceBeyond(c, s);
          s.traceArea(c);
          c.fillStyle = '#000';
          c.fill('evenodd');
          if (choke > 0) {
            c.beginPath();
            s.traceArea(c);
            c.lineWidth = choke * 2;
            c.lineJoin = 'round';
            c.strokeStyle = '#000';
            c.stroke();
          }
        });
      }
    },
  },
];

// ---- Elemental ----

const fire: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  const random = s.random(1);
  const flames = coveredEdge(s, reach * 0.34).map((p) => ({
    p,
    dir: rising(s, p, s.border ? 0.6 : 1),
    len: reach * (0.4 + random() * random() * 1.1) * (0.35 + 0.65 * p.w),
    width: reach * 0.3 * (0.8 + random() * 0.5),
    sway: random() * 2 - 1,
    phase: random() * Math.PI * 2,
  }));
  const layers = [
    { color: mix(c, '#3a0500', 0.3), len: 1, width: 1 },
    { color: c, len: 0.72, width: 0.68 },
    { color: mix(c, '#fff6c0', 0.7), len: 0.42, width: 0.4 },
  ];
  return [
    { op: 'screen', alpha: 0.7, paint: (ctx) => edgeGlow(ctx, s, rgba(c, 0.9), reach * 0.7) },
    {
      paint: (ctx) => {
        for (const layer of layers) {
          for (const f of flames) {
            const { p, dir } = f;
            const len = f.len * layer.len;
            const w = f.width * layer.width;
            const sway = (f.sway + Math.sin(s.time * 6 + f.phase) * 0.3) * len * 0.28;
            const t = { x: -dir.y, y: dir.x };
            const base = { x: p.x - dir.x * w * 0.4, y: p.y - dir.y * w * 0.4 };
            const tip = { x: p.x + dir.x * len + t.x * sway, y: p.y + dir.y * len + t.y * sway };
            const g = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
            g.addColorStop(0, rgba(layer.color, 1));
            g.addColorStop(0.55, rgba(layer.color, 0.85));
            g.addColorStop(1, rgba(layer.color, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(base.x - t.x * w * 0.5, base.y - t.y * w * 0.5);
            ctx.quadraticCurveTo(p.x + dir.x * len * 0.45 - t.x * w * 0.6, p.y + dir.y * len * 0.45 - t.y * w * 0.6, tip.x, tip.y);
            ctx.quadraticCurveTo(p.x + dir.x * len * 0.45 + t.x * w * 0.6, p.y + dir.y * len * 0.45 + t.y * w * 0.6, base.x + t.x * w * 0.5, base.y + t.y * w * 0.5);
            ctx.closePath();
            ctx.fill();
          }
        }
      },
    },
    {
      op: 'screen',
      paint: (ctx) => {
        const r2 = s.random(2);
        const core = mix(c, '#fff6c0', 0.75);
        for (const f of flames) {
          if (r2() > 0.3) continue;
          const d = f.len * (1 + r2() * 0.8) + s.time * reach;
          spark(ctx, f.p.x + f.dir.x * d + (r2() - 0.5) * reach * 0.4, f.p.y + f.dir.y * d, reach * (0.015 + r2() * 0.025), c, core);
        }
      },
    },
  ];
};

const frost: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  return [
    { op: 'screen', alpha: 0.75, paint: (ctx) => edgeGlow(ctx, s, rgba(c, 0.9), reach * 0.6, reach * 0.05) },
    {
      paint: (ctx) => {
        const random = s.random(1);
        for (const p of coveredEdge(s, reach * 0.22)) {
          const shards = 1 + Math.floor(random() * 2.5);
          for (let k = 0; k < shards; k++) {
            const turn = (random() * 2 - 1) * 0.65;
            const dir = { x: p.nx * Math.cos(turn) - p.ny * Math.sin(turn), y: p.nx * Math.sin(turn) + p.ny * Math.cos(turn) };
            const len = reach * (0.3 + random() * 0.75) * (0.3 + 0.7 * p.w);
            const w = reach * (0.05 + random() * 0.08);
            const t = { x: -dir.y, y: dir.x };
            const base = { x: p.x - dir.x * w, y: p.y - dir.y * w };
            const tip = { x: p.x + dir.x * len, y: p.y + dir.y * len };
            const g = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
            g.addColorStop(0, rgba(mix(c, '#3a6a9a', 0.3), 0.85));
            g.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(base.x - t.x * w, base.y - t.y * w);
            ctx.lineTo(tip.x, tip.y);
            ctx.lineTo(base.x + t.x * w, base.y + t.y * w);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = Math.max(0.5, w * 0.18);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.stroke();
            // The ridge down the middle catches the light.
            ctx.beginPath();
            ctx.moveTo(base.x, base.y);
            ctx.lineTo(tip.x, tip.y);
            ctx.strokeStyle = rgba(shade(c, 0.6), 0.9);
            ctx.stroke();
          }
        }
      },
    },
    {
      op: 'screen',
      paint: (ctx) => {
        const random = s.random(2);
        const count = Math.round(8 + s.spread * 18);
        for (let i = 0; i < count; i++) {
          const p = s.at(random());
          if (coverage(s, p.low) < 0.3) continue;
          const d = reach * random() * 0.9;
          const x = p.x + p.nx * d;
          const y = p.y + p.ny * d;
          const r = reach * (0.06 + random() * 0.1);
          // A small six-armed crystal.
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = Math.max(0.5, r * 0.12);
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI) / 3 + random();
            ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
            ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          }
          ctx.stroke();
          puff(ctx, x, y, r * 1.2, c, 0.5);
        }
      },
    },
  ];
};

const poison: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  const dark = shade(c, -0.45);
  return [
    { alpha: 0.5, paint: (ctx) => edgeGlow(ctx, s, rgba(c, 0.85), reach * 0.6) },
    {
      paint: (ctx) => {
        const random = s.random(1);
        // Ooze clings all the way round; Spread sets how thickly.
        const pts = s.edge(s.edgeLength / Math.max(1, reach * 0.12)).map((p) => ({ ...p, w: (0.35 + 0.65 * s.spread) * (0.6 + 0.4 * random()) }));
        for (const p of pts) {
          const r = reach * (0.08 + random() * 0.12) * p.w;
          const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
          g.addColorStop(0, shade(c, 0.3));
          g.addColorStop(1, dark);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x + p.nx * r * 0.3, p.y + p.ny * r * 0.3, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Drips hanging under it (inside the opening, only from the top half).
        for (const p of pts) {
          if (random() > 0.22 || (!s.border && p.low > 0.55)) continue;
          const len = reach * (0.3 + random() * 0.9) * p.w;
          const w = reach * (0.05 + random() * 0.05);
          const x = p.x + p.nx * reach * 0.1;
          const y = p.y + p.ny * reach * 0.1;
          const g = ctx.createLinearGradient(x, y, x, y + len);
          g.addColorStop(0, dark);
          g.addColorStop(1, c);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x - w, y);
          ctx.quadraticCurveTo(x - w * 0.4, y + len * 0.6, x - w * 1.3, y + len);
          ctx.arc(x, y + len, w * 1.3, Math.PI, 0, true);
          ctx.quadraticCurveTo(x + w * 0.4, y + len * 0.6, x + w, y);
          ctx.closePath();
          ctx.fill();
          puff(ctx, x - w * 0.5, y + len - w * 0.4, w * 0.6, '#ffffff', 0.7);
        }
      },
    },
    {
      paint: (ctx) => {
        const random = s.random(2);
        const count = Math.round(6 + s.spread * 20);
        for (let i = 0; i < count; i++) {
          const p = s.at(random());
          const d = reach * (0.2 + random() * 0.9) + s.time * reach * 0.5;
          const r = reach * (0.03 + random() * 0.07);
          const x = p.x + p.nx * d;
          const y = p.y + p.ny * d;
          ctx.fillStyle = rgba(c, 0.35);
          ctx.strokeStyle = rgba(shade(c, 0.4), 0.9);
          ctx.lineWidth = Math.max(0.5, r * 0.18);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          puff(ctx, x - r * 0.35, y - r * 0.35, r * 0.35, '#ffffff', 0.9);
        }
      },
    },
  ];
};

const lightning: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  // A new strike pattern every 1/12 s once time moves.
  const random = s.random(1 + Math.floor(s.time * 12) * 31);
  const count = Math.round(2 + s.spread * 7);
  const bolts: Point[][] = [];
  for (let i = 0; i < count; i++) {
    const t0 = random();
    const a = s.at(t0);
    const b = s.at(t0 + 0.05 + random() * 0.12);
    const bulge = reach * (0.25 + random() * 0.7);
    const mid = { x: (a.x + b.x) / 2 + (a.nx + b.nx) * 0.5 * bulge, y: (a.y + b.y) / 2 + (a.ny + b.ny) * 0.5 * bulge };
    const main = [...jagged(a, mid, reach * 0.35, random), ...jagged(mid, b, reach * 0.35, random).slice(1)];
    bolts.push(main);
    // Forks off the main bolt.
    for (let k = 0; k < 3; k++) {
      const from = main[Math.floor(random() * main.length)]!;
      const turn = (random() * 2 - 1) * 1.1;
      const n = { x: (a.nx + b.nx) / 2, y: (a.ny + b.ny) / 2 };
      const dir = { x: n.x * Math.cos(turn) - n.y * Math.sin(turn), y: n.x * Math.sin(turn) + n.y * Math.cos(turn) };
      const len = reach * (0.25 + random() * 0.5);
      bolts.push(jagged(from, { x: from.x + dir.x * len, y: from.y + dir.y * len }, reach * 0.18, random, 4));
    }
  }
  const draw = (ctx: Ctx, width: number, style: string) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style;
    bolts.forEach((pts, i) => {
      ctx.lineWidth = width * (i % 4 === 0 ? 1 : 0.6);
      strokePoints(ctx, pts);
    });
  };
  return [
    { op: 'screen', alpha: 0.55, paint: (ctx) => edgeGlow(ctx, s, rgba(c, 0.8), reach * 0.5) },
    {
      paint: (ctx) => {
        ctx.shadowColor = c;
        ctx.shadowBlur = reach * 0.35;
        draw(ctx, Math.max(1, reach * 0.07), rgba(c, 0.9));
        ctx.shadowBlur = reach * 0.12;
        draw(ctx, Math.max(0.6, reach * 0.025), '#ffffff');
      },
    },
  ];
};

const necrotic: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  const deep = mix(c, '#000000', 0.55);
  return [
    { op: 'multiply', alpha: 0.9, paint: (ctx) => edgeGlow(ctx, s, rgba(deep, 1), reach * 1.1, reach * 0.1) },
    {
      paint: (ctx) => {
        const random = s.random(1);
        ctx.lineCap = 'round';
        ctx.shadowColor = rgba(c, 0.9);
        ctx.shadowBlur = reach * 0.2;
        for (const p of coveredEdge(s, reach * 0.35)) {
          const len = reach * (0.5 + random() * 0.9) * (0.4 + 0.6 * p.w);
          const curl = (random() * 2 - 1) * 1.6;
          const steps = 10;
          let x = p.x - p.nx * reach * 0.05;
          let y = p.y - p.ny * reach * 0.05;
          let a = Math.atan2(p.ny, p.nx);
          for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const nx = x + Math.cos(a) * (len / steps);
            const ny = y + Math.sin(a) * (len / steps);
            ctx.strokeStyle = rgba(i < steps / 2 ? deep : c, 0.85 * (1 - t));
            ctx.lineWidth = Math.max(0.5, reach * 0.16 * (1 - t) + reach * 0.01);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            x = nx;
            y = ny;
            a += (curl / steps) * (1 + t);
          }
        }
      },
    },
    {
      op: 'screen',
      paint: (ctx) => {
        const random = s.random(2);
        const mote = mix(c, '#c8ffb0', 0.55);
        const count = Math.round(6 + s.spread * 16);
        for (let i = 0; i < count; i++) {
          const p = s.at(random());
          if (coverage(s, p.low) < 0.3) continue;
          const d = reach * random() * 1.1;
          spark(ctx, p.x + p.nx * d, p.y + p.ny * d - s.time * reach * 0.3, reach * (0.015 + random() * 0.02), c, mote);
        }
      },
    },
  ];
};

const radiant: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  return [
    { op: 'screen', alpha: 0.85, paint: (ctx) => edgeGlow(ctx, s, rgba(c, 1), reach * 0.8, reach * 0.05) },
    {
      op: 'screen',
      paint: (ctx) => {
        const random = s.random(1);
        const count = Math.round(14 + s.spread * 30);
        if (s.border) {
          // Rays shining out all round the token.
          for (let i = 0; i < count; i++) {
            const p = s.at((i + random() * 0.6) / count);
            const len = reach * (0.5 + random() * 0.9);
            const w = reach * (0.05 + random() * 0.08);
            const t = { x: -p.ny, y: p.nx };
            const g = ctx.createLinearGradient(p.x, p.y, p.x + p.nx * len, p.y + p.ny * len);
            g.addColorStop(0, rgba(mix(c, '#ffffff', 0.5), 0.9));
            g.addColorStop(1, rgba(c, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(p.x - t.x * w, p.y - t.y * w);
            ctx.lineTo(p.x + p.nx * len, p.y + p.ny * len);
            ctx.lineTo(p.x + t.x * w, p.y + t.y * w);
            ctx.closePath();
            ctx.fill();
          }
          return;
        }
        // Shafts of light falling from above.
        const { minX, maxX, minY, maxY } = s.box;
        const w = maxX - minX;
        const h = maxY - minY;
        const source = { x: (minX + maxX) / 2, y: minY - h * 0.5 };
        const shafts = Math.round(4 + s.spread * 8);
        for (let i = 0; i < shafts; i++) {
          const x = minX + w * ((i + 0.5 + (random() - 0.5) * 0.6) / shafts);
          const width = w * (0.03 + random() * 0.06) * (0.5 + s.spread);
          const end = { x: source.x + (x - source.x) * 2.2, y: maxY + h * 0.2 };
          const g = ctx.createLinearGradient(source.x, minY, end.x, end.y);
          g.addColorStop(0, rgba(c, 0.75));
          g.addColorStop(Math.min(0.95, 0.35 + reach / h), rgba(c, 0.25));
          g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(end.x - width, end.y);
          ctx.lineTo(end.x + width, end.y);
          ctx.closePath();
          ctx.fill();
        }
      },
    },
    {
      op: 'screen',
      paint: (ctx) => {
        const random = s.random(2);
        const count = Math.round(5 + s.spread * 12);
        for (let i = 0; i < count; i++) {
          let p: Point;
          if (s.border) {
            const e = s.at(random());
            const d = reach * random() * 0.8;
            p = { x: e.x + e.nx * d, y: e.y + e.ny * d };
          } else {
            p = s.scatter(random);
          }
          const twinkle = 0.75 + 0.25 * Math.sin(s.time * 5 + i);
          glint(ctx, p.x, p.y, reach * (0.12 + random() * 0.22) * twinkle, mix(c, '#ffffff', 0.4), random());
        }
      },
    },
  ];
};

// ---- Condition looks ----

const bloodied: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  const dark = mix(c, '#000000', 0.45);
  return [
    { op: 'multiply', alpha: 0.6, clip: 'area', paint: (ctx) => edgeGlow(ctx, s, rgba(c, 1), reach * 1.4) },
    {
      paint: (ctx) => {
        const random = s.random(1);
        const count = Math.round(3 + s.spread * 8);
        for (let i = 0; i < count; i++) {
          let x: number;
          let y: number;
          if (s.border) {
            const p = s.at(random());
            const across = (random() - 0.5) * (s.area.bandInner - s.area.bandOuter);
            x = p.x + p.nx * across;
            y = p.y + p.ny * across;
          } else {
            // Mostly near the edge, some further in.
            const p = s.at(random());
            const d = reach * (0.2 + random() * random() * 3);
            x = p.x + p.nx * d;
            y = p.y + p.ny * d;
          }
          const r = reach * (0.18 + random() * 0.3);
          const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r * 1.1);
          g.addColorStop(0, shade(c, 0.1));
          g.addColorStop(1, dark);
          ctx.fillStyle = g;
          blob(ctx, x, y, r, random);
          ctx.fill();
          // Drops flung out around it.
          const drops = 4 + Math.floor(random() * 6);
          ctx.fillStyle = dark;
          for (let k = 0; k < drops; k++) {
            const a = random() * Math.PI * 2;
            const d = r * (1.15 + random() * 1.2);
            const dr = r * (0.06 + random() * 0.14);
            ctx.save();
            ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
            ctx.rotate(a);
            ctx.scale(1 + random() * 1.5, 1);
            ctx.beginPath();
            ctx.arc(0, 0, dr, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          // A run dripping down from some of them.
          if (random() < 0.55) {
            const len = r * (0.8 + random() * 1.8);
            const w = r * (0.12 + random() * 0.1);
            const dx = x + (random() - 0.5) * r;
            const gy = ctx.createLinearGradient(dx, y, dx, y + r + len);
            gy.addColorStop(0, dark);
            gy.addColorStop(1, c);
            ctx.fillStyle = gy;
            ctx.beginPath();
            ctx.moveTo(dx - w, y);
            ctx.lineTo(dx - w * 0.8, y + r * 0.5 + len);
            ctx.arc(dx, y + r * 0.5 + len, w * 1.15, Math.PI, 0, true);
            ctx.lineTo(dx + w, y);
            ctx.closePath();
            ctx.fill();
          }
          puff(ctx, x - r * 0.35, y - r * 0.35, r * 0.22, '#ffffff', 0.35);
        }
      },
    },
  ];
};

const petrified: Painter = (s) => {
  const { fx, reach } = s;
  return [
    // Stone colour, keeping the art's light and dark.
    {
      direct: true,
      op: 'color',
      clip: 'area',
      paint: (ctx) => {
        ctx.fillStyle = fx.color;
        ctx.fillRect(-s.area.R, -s.area.R, s.area.R * 2, s.area.R * 2);
      },
    },
    {
      op: 'overlay',
      alpha: 0.75,
      clip: 'area',
      paint: (ctx) => {
        const random = s.random(1);
        const { R } = s.area;
        ctx.fillStyle = '#808080';
        ctx.fillRect(-R, -R, R * 2, R * 2);
        for (let i = 0; i < 70; i++) {
          const x = (random() * 2 - 1) * R;
          const y = (random() * 2 - 1) * R;
          puff(ctx, x, y, R * (0.05 + random() * 0.18), random() < 0.5 ? '#d8d8d8' : '#2a2a2a', 0.35);
        }
        for (let i = 0; i < 500; i++) {
          ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
          ctx.fillRect((random() * 2 - 1) * R, (random() * 2 - 1) * R, R * 0.008 + 0.5, R * 0.008 + 0.5);
        }
      },
    },
    {
      clip: 'area',
      paint: (ctx) => {
        const random = s.random(2);
        const count = Math.round(2 + s.spread * 7);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const width = Math.max(0.6, reach * 0.035);
        for (let i = 0; i < count; i++) {
          const p = s.at(random());
          const len = reach * (1 + random() * 2.2);
          let a = Math.atan2(s.border ? -p.ny : p.ny, s.border ? -p.nx : p.nx) + (random() - 0.5) * 0.8;
          const pts: Point[] = [{ x: p.x, y: p.y }];
          for (let k = 0; k < 7; k++) {
            a += (random() - 0.5) * 1.1;
            const last = pts[pts.length - 1]!;
            pts.push({ x: last.x + Math.cos(a) * (len / 7), y: last.y + Math.sin(a) * (len / 7) });
          }
          const branch = pts[2 + Math.floor(random() * 3)]!;
          const b = a + (random() < 0.5 ? 1 : -1) * (0.7 + random() * 0.6);
          const fork = [branch, { x: branch.x + Math.cos(b) * len * 0.3, y: branch.y + Math.sin(b) * len * 0.3 }];
          for (const [dx, style, w] of [
            [width * 0.7, 'rgba(255, 255, 255, 0.3)', width],
            [0, 'rgba(25, 22, 20, 0.85)', width],
          ] as const) {
            ctx.strokeStyle = style;
            ctx.save();
            ctx.translate(dx, dx);
            ctx.lineWidth = w;
            strokePoints(ctx, pts);
            ctx.lineWidth = w * 0.7;
            strokePoints(ctx, fork);
            ctx.restore();
          }
        }
      },
    },
  ];
};

const ethereal: Painter = (s) => {
  const { fx, reach } = s;
  return [
    // See-through, more at the bottom, like a ghost fading away.
    {
      op: 'destination-out',
      alpha: 0.85,
      clip: 'area',
      paint: (ctx) => {
        const { minY, maxY } = s.box;
        const g = ctx.createLinearGradient(0, minY, 0, maxY);
        g.addColorStop(0, `rgba(0,0,0,${0.55 - s.spread * 0.2})`);
        g.addColorStop(1, `rgba(0,0,0,${0.8 + s.spread * 0.2})`);
        ctx.fillStyle = g;
        const R = s.area.R;
        ctx.fillRect(-R, -R, R * 2, R * 2);
      },
    },
    {
      op: 'screen',
      alpha: 0.7,
      clip: 'area',
      paint: (ctx) => {
        edgeGlow(ctx, s, rgba(fx.color, 1), reach * 1.2);
        const random = s.random(1);
        const { R } = s.area;
        for (let i = 0; i < 9; i++) {
          const p = s.scatter(random);
          puff(ctx, p.x + s.time * reach * 0.2, p.y, R * (0.15 + random() * 0.15), fx.color, 0.25, 2.5, (random() - 0.5) * 0.6);
        }
      },
    },
  ];
};

const frightened: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  return [
    {
      direct: true,
      op: 'color',
      alpha: 0.55,
      clip: 'area',
      paint: (ctx) => {
        ctx.fillStyle = c;
        ctx.fillRect(-s.area.R, -s.area.R, s.area.R * 2, s.area.R * 2);
      },
    },
    { op: 'multiply', alpha: 0.85, clip: 'area', paint: (ctx) => edgeGlow(ctx, s, rgba(mix(c, '#000000', 0.55), 1), reach * 1.6, reach * 0.15) },
    {
      paint: (ctx) => {
        // Shiver marks either side.
        const random = s.random(1);
        const marks = Math.round(2 + s.spread * 4);
        ctx.strokeStyle = rgba(mix(c, '#ffffff', 0.85), 0.9);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.8, reach * 0.045);
        for (let i = 0; i < marks; i++) {
          const side = i % 2 ? 1 : -1;
          const t = side > 0 ? 0.12 + random() * 0.26 : 0.62 + random() * 0.26;
          const p = s.at(t);
          // Three short arcs bowing away from the edge.
          const a = Math.atan2(p.ny, p.nx);
          for (let k = 0; k < 3; k++) {
            const r = reach * (0.35 + k * 0.22);
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, a - 0.45 + k * 0.08, a + 0.45 - k * 0.08);
            ctx.stroke();
          }
        }
      },
    },
  ];
};

const poisoned: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  return [
    {
      direct: true,
      op: 'color',
      alpha: 0.45,
      clip: 'area',
      paint: (ctx) => {
        ctx.fillStyle = c;
        ctx.fillRect(-s.area.R, -s.area.R, s.area.R * 2, s.area.R * 2);
      },
    },
    { op: 'multiply', alpha: 0.6, clip: 'area', paint: (ctx) => edgeGlow(ctx, s, rgba(mix(c, '#203000', 0.3), 1), reach * 2) },
    {
      paint: (ctx) => {
        const random = s.random(1);
        const count = Math.round(8 + s.spread * 22);
        for (let i = 0; i < count; i++) {
          const p = s.border ? s.scatter(random) : lowPoint(s, random);
          const r = reach * (0.12 + random() * 0.32);
          const y = p.y - s.time * reach * 0.8;
          ctx.fillStyle = rgba(c, 0.3);
          ctx.strokeStyle = rgba(shade(c, 0.35), 0.95);
          ctx.lineWidth = Math.max(0.5, r * 0.14);
          ctx.beginPath();
          ctx.arc(p.x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          puff(ctx, p.x - r * 0.38, y - r * 0.38, r * 0.32, '#ffffff', 0.95);
        }
      },
    },
  ];
};

const charmed: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  return [
    { op: 'screen', alpha: 0.65, clip: 'area', paint: (ctx) => edgeGlow(ctx, s, rgba(c, 1), reach * 1.4) },
    {
      paint: (ctx) => {
        const random = s.random(1);
        const count = Math.round(4 + s.spread * 9);
        for (let i = 0; i < count; i++) {
          const p = s.at((i + random() * 0.7) / count);
          const d = s.border ? reach * (random() - 0.3) * 0.6 : reach * (0.3 + random() * 1.4);
          const size = reach * (0.55 + random() * 0.6);
          heart(ctx, p.x + p.nx * d, p.y + p.ny * d - s.time * reach * 0.4, size, (random() - 0.5) * 0.8, c);
        }
      },
    },
  ];
};

const unconscious: Painter = (s) => {
  const { fx, reach } = s;
  return [
    {
      direct: true,
      op: 'saturation',
      alpha: 0.8,
      clip: 'area',
      paint: (ctx) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(-s.area.R, -s.area.R, s.area.R * 2, s.area.R * 2);
      },
    },
    {
      direct: true,
      op: 'multiply',
      alpha: 0.55,
      clip: 'area',
      paint: (ctx) => {
        ctx.fillStyle = fx.color;
        ctx.fillRect(-s.area.R, -s.area.R, s.area.R * 2, s.area.R * 2);
      },
    },
    {
      paint: (ctx) => {
        // "Z z z" drifting up to the top right.
        const { minX, maxX, minY, maxY } = s.box;
        const w = maxX - minX;
        const h = maxY - minY;
        let x = s.border ? maxX - w * 0.3 : minX + w * 0.68;
        let y = s.border ? minY + h * 0.26 : minY + h * 0.4;
        const count = 2 + Math.round(s.spread * 2);
        let size = reach * (s.border ? 1.3 : 0.85);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < count; i++) {
          const z = [
            { x: x - size / 2, y: y - size / 2 },
            { x: x + size / 2, y: y - size / 2 },
            { x: x - size / 2, y: y + size / 2 },
            { x: x + size / 2, y: y + size / 2 },
          ];
          ctx.strokeStyle = 'rgba(10, 12, 24, 0.85)';
          ctx.lineWidth = size * 0.3;
          strokePoints(ctx, z);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = size * 0.15;
          strokePoints(ctx, z);
          x += size * 0.85;
          y -= size * 0.95;
          size *= 0.72;
        }
      },
    },
  ];
};

// ---- Atmosphere ----

const mist: Painter = (s) => {
  const { fx, reach } = s;
  return [
    {
      paint: (ctx) => {
        const random = s.random(1);
        // On the border it wreathes the band rather than filling the square.
        const k0 = s.border ? 0.45 : 1;
        for (const p of coveredEdge(s, reach * 0.18 * k0)) {
          for (let k = 0; k < 2; k++) {
            const d = reach * k0 * (random() - (s.border ? 0.5 : 0)) * 0.8;
            const dir = rising(s, p, s.border ? 0 : 0.6);
            const r = reach * k0 * (0.3 + random() * 0.35) * (0.5 + 0.5 * p.w);
            const angle = Math.atan2(p.ny, p.nx) + Math.PI / 2;
            puff(ctx, p.x + dir.x * d + s.time * reach * 0.25, p.y + dir.y * d, r, fx.color, 0.32 * p.w, 2.2, s.border ? angle : 0);
          }
        }
      },
    },
  ];
};

const embers: Painter = (s) => {
  const { fx, reach } = s;
  const c = fx.color;
  const core = mix(c, '#fff3c0', 0.65);
  return [
    {
      op: 'screen',
      paint: (ctx) => {
        const random = s.random(1);
        const count = Math.round(14 + s.spread * 50);
        const height = s.box.maxY - s.box.minY;
        for (let i = 0; i < count; i++) {
          const p = s.border ? s.scatter(random) : lowPoint(s, random);
          const r = reach * (0.04 + random() * random() * 0.12);
          // Rising, wrapping back to the bottom.
          let y = p.y - s.time * reach * 2 * (0.5 + random());
          if (!s.border) while (y < s.box.minY) y += height;
          spark(ctx, p.x, y, r, c, core);
          if (random() < 0.3) {
            const g = ctx.createLinearGradient(p.x, y, p.x, y + r * 8);
            g.addColorStop(0, rgba(c, 0.6));
            g.addColorStop(1, rgba(c, 0));
            ctx.strokeStyle = g;
            ctx.lineWidth = r * 0.9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, y);
            ctx.lineTo(p.x + (random() - 0.5) * r * 3, y + r * 8);
            ctx.stroke();
          }
        }
      },
    },
  ];
};

const sparkles: Painter = (s) => {
  const { fx, reach } = s;
  return [
    {
      op: 'screen',
      paint: (ctx) => {
        const random = s.random(1);
        const count = Math.round(8 + s.spread * 28);
        for (let i = 0; i < count; i++) {
          const p = s.scatter(random);
          const big = random();
          const twinkle = 0.7 + 0.3 * Math.sin(s.time * 4 + i * 1.7);
          const r = reach * (0.15 + big * big * 0.85) * twinkle;
          if (big < 0.35) puff(ctx, p.x, p.y, r * 0.8, fx.color, 0.8);
          else glint(ctx, p.x, p.y, r, fx.color, random() * 0.4 - 0.2);
        }
      },
    },
  ];
};

const smoke: Painter = (s) => {
  const { fx, reach } = s;
  return [
    {
      paint: (ctx) => {
        const random = s.random(1);
        const k0 = s.border ? 0.5 : 1;
        for (const p of coveredEdge(s, reach * 0.45 * k0)) {
          const dir = rising(s, p, s.border ? 0.5 : 1);
          const d = reach * k0 * random() * 0.9;
          const x = p.x + dir.x * d;
          const y = p.y + dir.y * d - s.time * reach * 0.4;
          const r = reach * k0 * (0.3 + random() * 0.3) * (0.5 + 0.5 * p.w);
          for (let k = 0; k < 4; k++) {
            const a = random() * Math.PI * 2;
            const tone = shade(fx.color, (random() - 0.5) * 0.35);
            puff(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.4, r * (0.6 + random() * 0.5), tone, 0.3 * p.w);
          }
          // A wisp curling up from it.
          if (random() < 0.4) {
            ctx.strokeStyle = rgba(fx.color, 0.22);
            ctx.lineWidth = Math.max(0.5, reach * 0.05);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(x + reach * 0.3, y - reach * 0.4, x - reach * 0.25, y - reach * 0.7, x + reach * 0.1, y - reach);
            ctx.stroke();
          }
        }
      },
    },
  ];
};

// ---- Overlays (the Foreground section until v8) ----

/** An overlay effect's settings in the overlay painters' terms: Spread is how far it reaches, Size its scale. */
export function overlayParams(fx: EffectLayer, kind: OverlayKind): OverlayParams {
  return {
    kind,
    color: fx.color,
    size: fx.spread,
    softness: fx.softness,
    angle: fx.angle,
    scale: Math.min(400, Math.max(25, (fx.size / OVERLAY_BASE_SIZE) * 100)),
    seed: fx.seed,
    gradient: fx.gradient,
  };
}

const overlay =
  (kind: OverlayKind): Painter =>
  (s) => [{ paint: (ctx) => paintOverlay(ctx, overlayParams(s.fx, kind), s.box), clip: 'area' }];

// ---- Pictures (v8) ----

const tinted = new WeakMap<object, Map<string, CanvasImageSource>>();

/** The picture coloured with `color` (multiplied, so dark outlines stay dark), cached. */
function tintedPicture(pic: RenderSource, color: string): CanvasImageSource {
  let byColor = tinted.get(pic.image as object);
  if (!byColor) tinted.set(pic.image as object, (byColor = new Map()));
  const hit = byColor.get(color);
  if (hit) return hit;
  const c = newCanvas(pic.width, pic.height);
  const ctx = c.getContext('2d') as Ctx;
  ctx.drawImage(pic.image, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, pic.width, pic.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(pic.image, 0, 0);
  if (byColor.size > 8) byColor.clear();
  byColor.set(color, c as CanvasImageSource);
  return c as CanvasImageSource;
}

/**
 * A picture effect: one copy filling the area, or copies scattered round it
 * (Spread sets how many; 0 = one in the middle). Built-in sprites say how
 * their copies turn: any way, upright, or pointing out of the edge.
 */
const picture: Painter = (s) => {
  const pic = s.picture;
  if (!pic) return [];
  const { fx, box } = s;
  const image = fx.tint ? tintedPicture(pic, fx.color) : pic.image;
  const aspect = pic.width / Math.max(1, pic.height);
  const orient = (fx.image?.type === 'library' && effectPicture(fx.image.id)?.orient) || 'upright';
  return [
    {
      clip: 'area',
      paint: (ctx) => {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const cx = (box.minX + box.maxX) / 2;
        const cy = (box.minY + box.maxY) / 2;
        if (fx.layout === 'fill') {
          // Covers the area, like a background picture.
          const bw = box.maxX - box.minX;
          const bh = box.maxY - box.minY;
          const k = Math.max(bw / pic.width, bh / pic.height);
          ctx.drawImage(image, cx - (pic.width * k) / 2, cy - (pic.height * k) / 2, pic.width * k, pic.height * k);
          return;
        }
        const h = Math.max(2, fx.size * s.area.unit * 2);
        const draw = (x: number, y: number, size: number, turn: number, alpha: number) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(x, y);
          ctx.rotate(turn);
          ctx.drawImage(image, (-size * aspect) / 2, -size / 2, size * aspect, size);
          ctx.restore();
        };
        const count = Math.round((s.spread * 100) / 4);
        if (count === 0) {
          draw(cx, cy, h, 0, 1);
          return;
        }
        const random = s.random(31);
        for (let i = 0; i < count; i++) {
          const size = h * (0.65 + random() * 0.7);
          const alpha = 0.7 + random() * 0.3;
          if (orient === 'outward') {
            // Along the edge, pointing away from it (out of the token on the border, in from the edge inside).
            const p = s.at((i + random() * 0.6) / count);
            draw(p.x + p.nx * size * 0.3, p.y + p.ny * size * 0.3, size, Math.atan2(p.ny, p.nx) + Math.PI / 2, alpha);
          } else {
            const p = s.scatter(random);
            draw(p.x, p.y, size, orient === 'random' ? random() * Math.PI * 2 : 0, alpha);
          }
        }
      },
    },
  ];
};

export const PAINTERS: Record<EffectKind, Painter> = {
  innerGlow,
  outerGlow,
  fire,
  frost,
  poison,
  lightning,
  necrotic,
  radiant,
  bloodied,
  petrified,
  ethereal,
  frightened,
  poisoned,
  charmed,
  unconscious,
  mist,
  embers,
  sparkles,
  smoke,
  vignette: overlay('vignette'),
  gradient: overlay('gradient'),
  edgeShadow: overlay('shadow'),
  foliage: overlay('foliage'),
  cobwebs: overlay('cobwebs'),
  picture,
};
