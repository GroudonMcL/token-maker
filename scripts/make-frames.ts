// Draws the built-in picture frames (DESIGN.md §6.9) and saves them to
// public/frames/ as WebP with a see-through hole, plus small thumbnails for
// the picker. Everything is made by code here, so there is nothing to credit.
//
//   npm run make-frames
//
// The pictures are random but seeded, so running it again gives the same files.

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { FRAME_LIBRARY } from '../src/render/imageFrames';

const SIZE = 1024;
const C = SIZE / 2;
const THUMB = 96;
const OUT = 'public/frames';

type Ctx = SKRSContext2D;
type Rgb = [number, number, number];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth fractal value noise, 0…1. */
function makeNoise(seed: number) {
  const r = rng(seed);
  const N = 256;
  const table = Array.from({ length: N * N }, () => r());
  const at = (x: number, y: number) => table[(((y % N) + N) % N) * N + (((x % N) + N) % N)]!;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
  return (x: number, y: number, octaves = 4) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

const hexRgb = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/** Light from the top left, a little towards the viewer. */
const LIGHT = (() => {
  const v = [-0.6, -0.6, 0.55];
  const n = Math.hypot(...v);
  return v.map((x) => x / n) as [number, number, number];
})();

/**
 * How brightly a rounded (bevelled) band is lit at a point: `t` runs 0 at the
 * inner edge to 1 at the outer, (rx, ry) is the outward direction.
 */
function bevel(t: number, rx: number, ry: number, height = 1.2): number {
  const slope = Math.cos(Math.PI * t) * height;
  const nx = rx * slope;
  const ny = ry * slope;
  const n = Math.hypot(nx, ny, 1);
  return (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / n;
}

/**
 * Paints a ring between radii `inner` and `outer` (fractions of the half
 * size) pixel by pixel, with smooth edges. `colour` gets the outward
 * direction, the position across the band (0 inner … 1 outer), the angle
 * and the point, and returns a colour (and optionally an alpha).
 */
function ring(ctx: Ctx, inner: number, outer: number, colour: (p: { rx: number; ry: number; t: number; a: number; x: number; y: number }) => Rgb | [number, number, number, number]): void {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  const px = 1 / C;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const ux = (x + 0.5 - C) / C;
      const uy = (y + 0.5 - C) / C;
      const r = Math.hypot(ux, uy);
      const cover = clamp((r - inner) / px + 0.5) * clamp((outer - r) / px + 0.5);
      if (cover <= 0) continue;
      const c = colour({ rx: ux / r, ry: uy / r, t: (r - inner) / (outer - inner), a: Math.atan2(uy, ux), x: ux, y: uy });
      const alpha = cover * (c.length === 4 ? c[3] : 1);
      const i = (y * SIZE + x) * 4;
      const under = d[i + 3]! / 255;
      const out = alpha + under * (1 - alpha);
      for (let k = 0; k < 3; k++) d[i + k] = out > 0 ? (clamp(c[k]!, 0, 255) * alpha + d[i + k]! * under * (1 - alpha)) / out : 0;
      d[i + 3] = out * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** A shiny ball (rivets, studs, beads). */
function ball(ctx: Ctx, x: number, y: number, r: number, base: string, dark: string): void {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, base);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** A soft dark rim just inside the hole and outside the ring, so the frame sits on the art. */
function edgeShade(ctx: Ctx, r: number, width: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(C, C, r * C, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

const at = (r: number, a: number) => ({ x: C + Math.cos(a) * r * C, y: C + Math.sin(a) * r * C });

const painters: Record<string, (ctx: Ctx) => void> = {
  'gilded-laurel'(ctx) {
    const gold: Rgb = hexRgb('#d9a83e');
    const n = makeNoise(11);
    ring(ctx, 0.78, 0.9, ({ rx, ry, t, x, y }) => {
      const l = bevel(t, rx, ry);
      return scale(mixRgb(gold, [255, 244, 200], clamp((l - 0.55) * 1.6)), 0.55 + l * 0.6 + (n(x * 30, y * 30) - 0.5) * 0.1);
    });
    // Leaves climbing both sides from the bottom, meeting at the top.
    const leaf = (cx: number, cy: number, a: number, len: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-len, -len, len, len);
      const facing = Math.cos(a - (-3 * Math.PI) / 4);
      g.addColorStop(0, facing > 0 ? '#fff1b0' : '#f0c860');
      g.addColorStop(0.5, '#d4a040');
      g.addColorStop(1, '#6e4a12');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(len / 2, 0, len / 2, len * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,40,5,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(len * 0.9, 0);
      ctx.strokeStyle = 'rgba(90,55,10,0.6)';
      ctx.stroke();
      ctx.restore();
    };
    for (const side of [-1, 1]) {
      for (let i = 0; i < 13; i++) {
        const a = Math.PI / 2 + side * (0.2 + i * 0.2);
        const tangent = a - side * (Math.PI / 2);
        const len = 92 - i * 3;
        const p = at(0.84, a);
        leaf(p.x, p.y, tangent + side * 0.55 + Math.PI, len);
        leaf(p.x, p.y, tangent - side * 0.5 + Math.PI, len * 0.9);
      }
    }
    ball(ctx, C, C + 0.84 * C, 26, '#f0c860', '#6e4a12');
    edgeShade(ctx, 0.78, 6, 0.35);
  },

  'iron-rivets'(ctx) {
    const n = makeNoise(23);
    const iron: Rgb = hexRgb('#5c6068');
    ring(ctx, 0.76, 0.95, ({ rx, ry, t, x, y }) => {
      const lip = t < 0.14 ? bevel(t / 0.14, rx, ry, 2) : bevel((t - 0.14) / 0.86, rx, ry, 0.8);
      const hammer = n(x * 22, y * 22, 3);
      const base = t < 0.14 ? scale(iron, 0.85) : iron;
      return scale(mixRgb(base, [214, 220, 230], clamp(lip - 0.6)), 0.45 + lip * 0.6 + (hammer - 0.5) * 0.35);
    });
    for (let i = 0; i < 16; i++) {
      const p = at(0.865, (i / 16) * Math.PI * 2);
      ball(ctx, p.x, p.y, 17, '#9aa0a8', '#24262b');
    }
    edgeShade(ctx, 0.76, 6, 0.4);
  },

  runestone(ctx) {
    const n = makeNoise(37);
    const stone: Rgb = hexRgb('#8a857b');
    ring(ctx, 0.74, 0.96, ({ rx, ry, t, x, y }) => {
      const l = bevel(t, rx, ry, 0.9);
      const grain = n(x * 8, y * 8, 5);
      const crack = Math.abs(n(x * 5 + 9, y * 5 + 3, 3) - 0.5) < 0.012 ? 0.55 : 1;
      return scale(mixRgb(stone, hexRgb('#5a564e'), grain), (0.5 + l * 0.6) * crack);
    });
    // Glowing runes cut into the stone.
    const r = rng(5);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const p = at(0.85, a);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      const strokes = 2 + Math.floor(r() * 3);
      ctx.moveTo(0, -30);
      ctx.lineTo(0, 30);
      for (let s = 0; s < strokes; s++) {
        const y0 = -26 + r() * 40;
        const dir = r() < 0.5 ? -1 : 1;
        ctx.moveTo(0, y0);
        ctx.lineTo(dir * (10 + r() * 10), y0 + 10 + r() * 12);
      }
      ctx.shadowColor = 'rgba(80,220,255,0.9)';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#2a2622';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = '#8ff0ff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    edgeShade(ctx, 0.74, 8, 0.45);
  },

  thorns(ctx) {
    const r = rng(41);
    // Thorns first, so the vines cover their roots.
    const thorn = (a: number, inward: boolean) => {
      const base = at(inward ? 0.8 : 0.9, a);
      const tip = at(inward ? 0.74 - r() * 0.03 : 0.96 + r() * 0.03, a + (r() - 0.5) * 0.08);
      const side = 0.022;
      const b1 = at(inward ? 0.81 : 0.89, a - side);
      const b2 = at(inward ? 0.81 : 0.89, a + side);
      const g = ctx.createLinearGradient(b1.x, b1.y, tip.x, tip.y);
      g.addColorStop(0, '#5a3a22');
      g.addColorStop(1, '#c9b48a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(b1.x, b1.y);
      ctx.quadraticCurveTo(base.x, base.y, tip.x, tip.y);
      ctx.lineTo(b2.x, b2.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,18,10,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    for (let i = 0; i < 26; i++) thorn((i / 26) * Math.PI * 2 + r() * 0.1, false);
    for (let i = 0; i < 20; i++) thorn((i / 20) * Math.PI * 2 + 0.12 + r() * 0.1, true);
    const bark: Rgb = hexRgb('#5e3c24');
    const n = makeNoise(43);
    // Two vines twisting round each other.
    ring(ctx, 0.795, 0.905, ({ rx, ry, t, a, x, y }) => {
      const twist = Math.sin(a * 22) * 0.5 + 0.5;
      const strand = t < twist ? t / Math.max(0.01, twist) : (t - twist) / Math.max(0.01, 1 - twist);
      const l = bevel(strand, rx, ry, 1.6);
      const grain = n(a * 60, (x + y) * 4, 3);
      return scale(mixRgb(bark, [150, 110, 70], clamp(l - 0.5)), 0.35 + l * 0.65 + (grain - 0.5) * 0.25);
    });
    edgeShade(ctx, 0.8, 5, 0.35);
  },

  'dragon-scales'(ctx) {
    const rows = 4;
    const perRow = 44;
    const inner = 0.76;
    const outer = 0.96;
    const green: Rgb = hexRgb('#2f6a3a');
    const bronze: Rgb = hexRgb('#b08a3a');
    ring(ctx, inner, outer, ({ rx, ry, t, a }) => {
      // Scales overlap from the outside in; each is lit as a little dome.
      const row = Math.min(rows - 1, Math.floor(t * rows));
      const turn = ((a / (Math.PI * 2)) * perRow + (row % 2) * 0.5 + perRow) % 1;
      const across = turn - 0.5;
      const down = t * rows - row;
      const dome = clamp(1 - Math.hypot(across * 1.6, (1 - down) * 1.1));
      const edge = dome < 0.08 ? 0.45 : 1;
      const l = bevel(t, rx, ry, 0.6) + across * 0.25 * -rx;
      const tone = mixRgb(green, bronze, clamp(row / (rows - 1)) * 0.6 + dome * 0.3);
      return scale(tone, (0.45 + l * 0.55 + dome * 0.35) * edge);
    });
    edgeShade(ctx, 0.76, 6, 0.45);
  },

  celestial(ctx) {
    // Eight star points behind the ring, reaching into the square's corners.
    const silver = '#d8dee8';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const long = i % 2 === 1;
      const tip = at(long ? 1.32 : 1.02, a);
      const l = at(0.86, a - 0.13);
      const rr = at(0.86, a + 0.13);
      const facing = Math.cos(a - (-3 * Math.PI) / 4);
      for (const [p, k] of [[l, facing > 0 ? 0.95 : 0.6], [rr, facing > 0 ? 0.7 : 0.45]] as const) {
        ctx.fillStyle = `rgb(${Math.round(216 * k)},${Math.round(222 * k)},${Math.round(232 * k)})`;
        ctx.beginPath();
        ctx.moveTo(C + Math.cos(a) * 0.86 * C, C + Math.sin(a) * 0.86 * C);
        ctx.lineTo(p.x, p.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(40,46,60,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(rr.x, rr.y);
      ctx.stroke();
    }
    const base: Rgb = hexRgb(silver);
    ring(ctx, 0.8, 0.92, ({ rx, ry, t }) => {
      const l = bevel(t, rx, ry, 1.4);
      return scale(mixRgb(base, [255, 255, 255], clamp(l - 0.7)), 0.4 + l * 0.65);
    });
    ring(ctx, 0.835, 0.885, ({ rx, ry, t }) => {
      const l = bevel(1 - t, rx, ry, 1.2);
      return scale(hexRgb('#3a4a8a'), 0.5 + l * 0.5);
    });
    const r = rng(61);
    for (let i = 0; i < 24; i++) {
      const p = at(0.86, (i / 24) * Math.PI * 2 + 0.13);
      const s = 5 + r() * 4;
      ctx.fillStyle = '#fff7d8';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rad = k % 2 ? s * 0.35 : s;
        ctx[k ? 'lineTo' : 'moveTo'](p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    }
    edgeShade(ctx, 0.8, 6, 0.4);
  },

  rope(ctx) {
    const rope: Rgb = hexRgb('#c2a070');
    const n = makeNoise(71);
    ring(ctx, 0.8, 0.94, ({ rx, ry, t, a }) => {
      // Strands wind diagonally round the rope.
      const twists = 38;
      const phase = (((a / (Math.PI * 2)) * twists + t * 0.9) % 1 + 1) % 1;
      const strand = Math.sin(phase * Math.PI);
      const l = bevel(t, rx, ry, 1.3);
      const fibre = n(a * 200, t * 6, 2);
      return scale(mixRgb(rope, [240, 220, 180], clamp(l - 0.6)), (0.35 + l * 0.6) * (0.55 + strand * 0.45) + (fibre - 0.5) * 0.1);
    });
    edgeShade(ctx, 0.8, 5, 0.35);
  },

  'shield-rim'(ctx) {
    const n = makeNoise(83);
    const wood: Rgb = hexRgb('#8a5a32');
    ring(ctx, 0.76, 0.86, ({ rx, ry, t, a, x, y }) => {
      const plank = (((a / (Math.PI * 2)) * 18) % 1 + 1) % 1;
      const seam = plank < 0.03 || plank > 0.97 ? 0.45 : 1;
      const grain = n(a * 40, t * 3 + x * 0.5 + y * 0.5, 4);
      const l = bevel(t, rx, ry, 0.5);
      return scale(mixRgb(wood, hexRgb('#4a2e18'), grain), (0.55 + l * 0.5) * seam);
    });
    const steel: Rgb = hexRgb('#8c929c');
    ring(ctx, 0.855, 0.96, ({ rx, ry, t, x, y }) => {
      const l = bevel(t, rx, ry, 1.5);
      return scale(mixRgb(steel, [230, 236, 244], clamp(l - 0.65)), 0.4 + l * 0.6 + (n(x * 25, y * 25, 2) - 0.5) * 0.12);
    });
    for (let i = 0; i < 12; i++) {
      const p = at(0.905, (i / 12) * Math.PI * 2 + Math.PI / 12);
      ball(ctx, p.x, p.y, 13, '#c9a24a', '#4a3410');
    }
    edgeShade(ctx, 0.76, 6, 0.45);
  },
};

mkdirSync(OUT, { recursive: true });
for (const { id } of FRAME_LIBRARY) {
  const draw = painters[id];
  if (!draw) throw new Error(`No painter for ${id}`);
  const c = createCanvas(SIZE, SIZE);
  draw(c.getContext('2d'));
  writeFileSync(`${OUT}/${id}.webp`, c.toBuffer('image/webp', 88));
  const t = createCanvas(THUMB, THUMB);
  const tctx = t.getContext('2d');
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(c, 0, 0, THUMB, THUMB);
  writeFileSync(`${OUT}/${id}-thumb.webp`, t.toBuffer('image/webp', 80));
  console.log(`Wrote ${OUT}/${id}.webp`);
}
