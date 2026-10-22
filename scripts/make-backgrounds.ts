// Draws the built-in background pictures (DESIGN.md §6.3) and saves them to
// public/backgrounds/ as WebP, with small thumbnails for the picker.
// Everything is made by code here, so there is nothing to credit.
//
//   npm run make-backgrounds
//
// The pictures are random but seeded, so running it again gives the same files.

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BACKGROUND_LIBRARY } from '../src/render/backgroundLibrary';

const SIZE = 1024;
const THUMB = 96;
const OUT = 'public/backgrounds';

type Ctx = SKRSContext2D;

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

/** Smooth value noise in 0…1, tiling every `period` cells. */
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
  /** Fractal noise: several octaves added together, 0…1. */
  return (x: number, y: number, octaves = 5) => {
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

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** A colour from a list of stops at 0…1. */
function ramp(stops: [number, string][], t: number): Rgb {
  const c = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const [p, a] = stops[i - 1]!;
    const [q, b] = stops[i]!;
    if (c <= q) return mixRgb(hex(a), hex(b), (c - p) / Math.max(1e-6, q - p));
  }
  return hex(stops[stops.length - 1]![1]);
}

/** Fills the canvas pixel by pixel from `f(x, y)` (x, y in 0…1). */
function paint(ctx: Ctx, f: (x: number, y: number) => Rgb) {
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = f(x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function vignette(ctx: Ctx, strength: number) {
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.3, SIZE / 2, SIZE / 2, SIZE * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

const painters: Record<string, (ctx: Ctx) => void> = {
  forest(ctx) {
    const n = makeNoise(11);
    // Misty sky and ground.
    paint(ctx, (x, y) => mixRgb(ramp([[0, '#b8c9b0'], [0.55, '#8fa88a'], [1, '#2c3d24']], y), [255, 255, 255], (n(x * 3, y * 3) - 0.5) * 0.12));
    const r = rng(12);
    // Rows of trees, far (pale, small) to near (dark, big), with mist between.
    const rows = [
      { y: 0.55, h: 0.35, w: 0.05, c: '#7f9878', count: 22 },
      { y: 0.63, h: 0.45, w: 0.07, c: '#5d7a55', count: 16 },
      { y: 0.74, h: 0.6, w: 0.1, c: '#3c5636', count: 11 },
      { y: 0.92, h: 0.85, w: 0.14, c: '#1f3019', count: 7 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const cx = (i + r() * 0.8) / row.count;
        const h = row.h * (0.75 + r() * 0.4);
        const w = row.w * (0.8 + r() * 0.4);
        const base = row.y + r() * 0.04;
        ctx.fillStyle = row.c;
        // Trunk.
        ctx.fillRect((cx - w * 0.08) * SIZE, (base - h * 0.35) * SIZE, w * 0.16 * SIZE, h * 0.4 * SIZE);
        // Layered conifer canopy.
        for (let k = 0; k < 4; k++) {
          const ty = base - h * (0.25 + k * 0.2);
          const tw = w * (1 - k * 0.2);
          ctx.beginPath();
          ctx.moveTo((cx - tw / 2) * SIZE, ty * SIZE);
          ctx.lineTo(cx * SIZE, (ty - h * 0.32) * SIZE);
          ctx.lineTo((cx + tw / 2) * SIZE, ty * SIZE);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Mist in front of the row.
      const m = ctx.createLinearGradient(0, (row.y - 0.1) * SIZE, 0, (row.y + 0.06) * SIZE);
      m.addColorStop(0, 'rgba(220,230,215,0)');
      m.addColorStop(1, 'rgba(220,230,215,0.35)');
      ctx.fillStyle = m;
      ctx.fillRect(0, (row.y - 0.1) * SIZE, SIZE, 0.16 * SIZE);
    }
    // Shafts of light.
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = 0.2 + r() * 0.6;
      const g = ctx.createLinearGradient(x * SIZE, 0, (x + 0.15) * SIZE, SIZE);
      g.addColorStop(0, 'rgba(255,250,210,0.18)');
      g.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x * SIZE, 0);
      ctx.lineTo((x + 0.05) * SIZE, 0);
      ctx.lineTo((x + 0.25) * SIZE, SIZE);
      ctx.lineTo((x + 0.1) * SIZE, SIZE);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    vignette(ctx, 0.35);
  },

  dungeon(ctx) {
    const n = makeNoise(21);
    const rows = 9;
    paint(ctx, (x, y) => {
      const row = Math.floor(y * rows);
      const offset = row % 2 ? 0.5 / 5 : 0;
      const cols = 5;
      const bx = (x + offset) * cols;
      const fx = bx - Math.floor(bx);
      const fy = y * rows - row;
      const mortar = Math.min(fx, 1 - fx) * 3 < 0.06 || Math.min(fy, 1 - fy) < 0.05;
      const brick = Math.floor(bx) * 7 + row * 13;
      const tone = 0.35 + ((brick * 2654435761) % 1000) / 1000 * 0.2 + (n(x * 12, y * 12) - 0.5) * 0.35;
      if (mortar) return ramp([[0, '#121216'], [1, '#2a2a30']], n(x * 40, y * 40));
      const edge = Math.min(fx * 3, (1 - fx) * 3, fy, 1 - fy);
      const bevel = Math.min(1, edge * 6);
      return ramp([[0, '#1e1f26'], [0.5, '#4a4b55'], [1, '#7a7b84']], tone * (0.75 + bevel * 0.25));
    });
    vignette(ctx, 0.55);
  },

  parchment(ctx) {
    const n = makeNoise(31);
    paint(ctx, (x, y) => {
      const d = Math.hypot(x - 0.5, y - 0.5);
      const stain = n(x * 4, y * 4) * 0.6 + n(x * 18, y * 18) * 0.4;
      const t = 0.25 + stain * 0.5 + d * 0.5;
      return ramp([[0, '#f3e2bd'], [0.5, '#dcc08a'], [0.8, '#b48a4e'], [1, '#6f4e26']], t);
    });
    // Fibres.
    const r = rng(32);
    ctx.strokeStyle = 'rgba(120,85,40,0.08)';
    for (let i = 0; i < 600; i++) {
      const x = r() * SIZE;
      const y = r() * SIZE;
      ctx.lineWidth = 0.5 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 10);
      ctx.stroke();
    }
  },

  'night-sky'(ctx) {
    const n = makeNoise(41);
    paint(ctx, (x, y) => {
      const band = Math.exp(-(((x - y) * 1.3 - 0.0) ** 2) * 8);
      const cloud = n(x * 5, y * 5) * band;
      return mixRgb(ramp([[0, '#05071a'], [0.6, '#101a3d'], [1, '#2a2350']], y), [150, 140, 210], cloud * 0.45);
    });
    const r = rng(42);
    for (let i = 0; i < 900; i++) {
      const s = r() ** 3 * 2.4 + 0.4;
      ctx.fillStyle = `rgba(255,255,${200 + r() * 55},${0.4 + r() * 0.6})`;
      ctx.beginPath();
      ctx.arc(r() * SIZE, r() * SIZE, s, 0, Math.PI * 2);
      ctx.fill();
    }
    // The moon, with a glow.
    const mx = SIZE * 0.72;
    const my = SIZE * 0.26;
    const glow = ctx.createRadialGradient(mx, my, 40, mx, my, 260);
    glow.addColorStop(0, 'rgba(230,235,255,0.35)');
    glow.addColorStop(1, 'rgba(230,235,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#eef0f8';
    ctx.beginPath();
    ctx.arc(mx, my, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,165,190,0.35)';
    for (const [dx, dy, rr] of [[-18, -10, 14], [16, 14, 10], [-4, 24, 8], [22, -18, 7]] as const) {
      ctx.beginPath();
      ctx.arc(mx + dx, my + dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  lava(ctx) {
    const n = makeNoise(51);
    paint(ctx, (x, y) => {
      const v = n(x * 6, y * 6, 6);
      const crack = Math.abs(v - 0.5);
      const heat = Math.max(0, 1 - crack * 14);
      const rock = ramp([[0, '#120806'], [1, '#3a2018']], n(x * 20, y * 20));
      return mixRgb(rock, ramp([[0, '#b3200a'], [0.6, '#ff7a12'], [1, '#ffe27a']], heat), Math.min(1, heat * 1.2));
    });
    vignette(ctx, 0.4);
  },

  water(ctx) {
    const n = makeNoise(61);
    paint(ctx, (x, y) => {
      const w = n(x * 6 + n(x * 2, y * 2) * 2, y * 14, 4);
      const ripple = Math.sin((y * 40 + w * 6) * Math.PI) * 0.5 + 0.5;
      const base = ramp([[0, '#0b3a5c'], [0.6, '#145f86'], [1, '#1d7ea0']], 1 - y * 0.6 + (w - 0.5) * 0.5);
      return mixRgb(base, [200, 235, 255], ripple ** 8 * 0.45);
    });
    vignette(ctx, 0.35);
  },

  tavern(ctx) {
    const n = makeNoise(71);
    const planks = 6;
    paint(ctx, (x, y) => {
      const p = Math.floor(y * planks);
      const fy = y * planks - p;
      const grain = n(x * 3 + p * 10, fy * 30 + p * 3, 4);
      const rings = Math.sin((grain * 18 + x * 4) * Math.PI) * 0.5 + 0.5;
      const tone = 0.35 + (p % 3) * 0.08 + rings * 0.25 + (grain - 0.5) * 0.4;
      const gap = fy < 0.03 || fy > 0.97;
      if (gap) return [25, 14, 8];
      const seam = Math.abs(((x + p * 0.37) % 0.5) - 0.25) < 0.002;
      if (seam) return [40, 22, 12];
      return ramp([[0, '#3b200f'], [0.5, '#7a4a24'], [1, '#b07a43']], tone);
    });
    // Nails.
    ctx.fillStyle = '#1d1410';
    for (let p = 0; p < planks; p++) {
      for (const x of [0.06, 0.94]) {
        ctx.beginPath();
        ctx.arc(x * SIZE, ((p + 0.5) / planks) * SIZE, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    vignette(ctx, 0.45);
  },

  snow(ctx) {
    const n = makeNoise(81);
    paint(ctx, (x, y) => {
      const hill = 0.55 + (n(x * 2, 0.5, 3) - 0.5) * 0.25;
      if (y < hill) return ramp([[0, '#a9bfd6'], [1, '#e2ebf3']], y / hill + (n(x * 3, y * 3) - 0.5) * 0.15);
      return ramp([[0, '#f4f8fc'], [1, '#c7d6e6']], (y - hill) * 1.6 + (n(x * 8, y * 8) - 0.5) * 0.3);
    });
    const r = rng(82);
    // Distant pines.
    ctx.fillStyle = 'rgba(80,100,120,0.55)';
    for (let i = 0; i < 18; i++) {
      const x = r() * SIZE;
      const base = SIZE * (0.5 + r() * 0.08);
      const h = 40 + r() * 70;
      ctx.beginPath();
      ctx.moveTo(x - h * 0.25, base);
      ctx.lineTo(x, base - h);
      ctx.lineTo(x + h * 0.25, base);
      ctx.fill();
    }
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
      ctx.beginPath();
      ctx.arc(r() * SIZE, r() * SIZE, 1 + r() ** 2 * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  swamp(ctx) {
    const n = makeNoise(91);
    paint(ctx, (x, y) => {
      if (y > 0.68) {
        const w = n(x * 10, y * 30, 3);
        return mixRgb(ramp([[0, '#2b3a22'], [1, '#141c10']], (y - 0.68) * 3), [120, 140, 90], (w - 0.4) * 0.3);
      }
      return mixRgb(ramp([[0, '#9aa77e'], [1, '#55663f']], y / 0.68), [200, 210, 180], (n(x * 3, y * 3) - 0.5) * 0.3);
    });
    const r = rng(92);
    // Dead trees and reeds.
    ctx.strokeStyle = '#1d2617';
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = r() * SIZE;
      const base = SIZE * 0.7;
      const h = SIZE * (0.3 + r() * 0.3);
      ctx.lineWidth = 10 + r() * 14;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + (r() - 0.5) * 80, base - h / 2, x + (r() - 0.5) * 60, base - h);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) {
        const by = base - h * (0.4 + k * 0.18);
        ctx.beginPath();
        ctx.moveTo(x, by);
        ctx.lineTo(x + (r() - 0.5) * 160, by - 40 - r() * 60);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 2;
    for (let i = 0; i < 140; i++) {
      const x = r() * SIZE;
      const base = SIZE * (0.68 + r() * 0.3);
      ctx.strokeStyle = `rgba(30,40,22,${0.6 + r() * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x + (r() - 0.5) * 20, base - 30 - r() * 60);
      ctx.stroke();
    }
    const fog = ctx.createLinearGradient(0, SIZE * 0.45, 0, SIZE * 0.75);
    fog.addColorStop(0, 'rgba(200,210,180,0)');
    fog.addColorStop(1, 'rgba(200,210,180,0.35)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, SIZE, SIZE);
    vignette(ctx, 0.45);
  },

  desert(ctx) {
    const n = makeNoise(101);
    paint(ctx, (x, y) => {
      const d1 = 0.5 + Math.sin(x * 5 + 1) * 0.05 + (n(x * 2, 1, 3) - 0.5) * 0.1;
      const d2 = 0.68 + Math.sin(x * 3.2 + 2.5) * 0.07;
      if (y < d1) return ramp([[0, '#7fb2d8'], [1, '#f2d6a2']], y / d1);
      const ripple = Math.sin((y * 60 + n(x * 6, y * 6) * 8) * Math.PI) * 0.5 + 0.5;
      const near = y > d2;
      const base = near ? ramp([[0, '#e2a35a'], [1, '#b06a2c']], (y - d2) * 2.5) : ramp([[0, '#e9be82'], [1, '#d39450']], (y - d1) * 4);
      return mixRgb(base, [255, 235, 200], ripple ** 6 * 0.18);
    });
    const sun = ctx.createRadialGradient(SIZE * 0.25, SIZE * 0.2, 10, SIZE * 0.25, SIZE * 0.2, 220);
    sun.addColorStop(0, 'rgba(255,250,225,0.95)');
    sun.addColorStop(0.2, 'rgba(255,240,200,0.5)');
    sun.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, SIZE, SIZE);
  },
};

mkdirSync(OUT, { recursive: true });
for (const { id } of BACKGROUND_LIBRARY) {
  const draw = painters[id];
  if (!draw) throw new Error(`No painter for ${id}`);
  const c = createCanvas(SIZE, SIZE);
  draw(c.getContext('2d'));
  writeFileSync(`${OUT}/${id}.webp`, c.toBuffer('image/webp', 82));
  const t = createCanvas(THUMB, THUMB);
  const tctx = t.getContext('2d');
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(c, 0, 0, THUMB, THUMB);
  writeFileSync(`${OUT}/${id}-thumb.webp`, t.toBuffer('image/webp', 80));
  console.log(`Wrote ${OUT}/${id}.webp`);
}
