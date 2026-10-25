// Effects (DESIGN.md §5.4): non-destructive filters on a layer's picture,
// applied in order before it is composited. They work on the picture's
// pixels, so they suit any layer (or group) whatever drew it.
//
// The bevel is the 2.5D surface system: a height map is made from the
// picture's shape (each pixel's distance from the edge, through a profile)
// plus a procedural surface, turned into normals and lit by the stage's light,
// so every bevelled layer is lit as one object. Sizes are in band widths, so
// an effect looks the same at every token size and thickness. Everything is
// plain arithmetic on the pixels (no canvas filters), so the preview, the
// export and the tests (node) draw exactly the same picture.

import type { StageSettings } from '../project/types';
import type { AdjustEffect, BevelEffect, BevelProfile, DistortEffect, Effect, ExtrudeEffect, OffsetEffect, GlowEffect, GradientStop, RecolourEffect, ShadowEffect, Surface, WearEffect } from '../project/types';
import type { Ctx } from './canvas';
import { lightVector } from './light';

export interface EffectEnv {
  /** The band's width in pixels: the unit of every size. */
  bw: number;
  /** The stage's light, in degrees. */
  light: number;
  /** Height (pixels, raised positive) other layers add to a bevel's own: a group's shared height map (version 8). */
  height?: Float32Array;
  /** Draw bevels as their height map or normal map instead of lit (the editor's views, version 8). */
  view?: RenderView;
  /** The stage's lighting rig (version 9): more coloured lights, and an ambient colour for shaded sides. */
  rig?: Pick<StageSettings, 'lights' | 'ambient' | 'ambientStrength'>;
}

export type RenderView = 'picture' | 'height' | 'normals';

/** Effects that are switched on. */
export const activeEffects = (effects: Effect[] | undefined) => (effects ?? []).filter((e) => e.on);

/** Applies `effects` (first first) to the whole `size`×`size` picture drawn on `ctx`. */
export function applyEffects(ctx: Ctx, size: number, effects: Effect[], env: EffectEnv): void {
  const on = activeEffects(effects);
  if (on.length === 0) return;
  const image = ctx.getImageData(0, 0, size, size);
  const px = image.data;
  // Nothing painted, nothing to do (a shadow or glow needs something to come from).
  let any = false;
  for (let i = 3; i < px.length; i += 4) if (px[i]) { any = true; break; }
  if (!any) return;
  for (const e of on) {
    switch (e.kind) {
      case 'bevel':
        bevel(px, size, e, env);
        break;
      case 'shadow':
        shadow(px, size, e, env);
        break;
      case 'glow':
        glow(px, size, e, env);
        break;
      case 'recolour':
        recolour(px, e);
        break;
      case 'adjust':
        adjust(px, e);
        break;
      case 'wear':
        wear(px, size, e, env);
        break;
      case 'distort':
        distort(px, size, e, env);
        break;
      case 'extrude':
        extrude(px, size, e, env);
        break;
      case 'offset':
        offset(px, size, e, env);
        break;
    }
  }
  ctx.putImageData(image, 0, 0);
}

// ---------------------------------------------------------------- helpers

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function rgbOf(hex: string): [number, number, number] {
  const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function alphaOf(px: Uint8ClampedArray): Float32Array {
  const a = new Float32Array(px.length / 4);
  for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3] / 255;
  return a;
}

/**
 * A box blur run three times (close to a Gaussian), `r` pixels each way.
 * Outside the picture counts as `edge`. Wide blurs are made on a smaller
 * copy and scaled back up, which looks the same and is much quicker.
 */
export function blur(src: Float32Array, size: number, r: number, edge = 0): Float32Array {
  const radius = r / 1.7;
  if (radius < 1) return src.slice();
  const f = radius >= 8 ? Math.min(8, Math.floor(radius / 4)) : 1;
  if (f === 1) return boxBlur(src, size, Math.round(radius), edge);
  const small = Math.ceil(size / f);
  const down = new Float32Array(small * small);
  for (let y = 0; y < small; y++)
    for (let x = 0; x < small; x++) {
      let sum = 0;
      for (let j = 0; j < f; j++) {
        const sy = y * f + j;
        for (let i = 0; i < f; i++) {
          const sx = x * f + i;
          sum += sx < size && sy < size ? src[sy * size + sx] : edge;
        }
      }
      down[y * small + x] = sum / (f * f);
    }
  const blurred = boxBlur(down, small, Math.max(1, Math.round(radius / f)), edge);
  // Back up, blending between the small copy's pixel centres.
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y + 0.5) / f - 0.5;
    const y0 = Math.max(0, Math.min(small - 1, Math.floor(fy)));
    const y1 = Math.min(small - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < size; x++) {
      const fx = (x + 0.5) / f - 0.5;
      const x0 = Math.max(0, Math.min(small - 1, Math.floor(fx)));
      const x1 = Math.min(small - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));
      const top = blurred[y0 * small + x0] * (1 - tx) + blurred[y0 * small + x1] * tx;
      const bottom = blurred[y1 * small + x0] * (1 - tx) + blurred[y1 * small + x1] * tx;
      out[y * size + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

function boxBlur(src: Float32Array, size: number, r: number, edge: number): Float32Array {
  const a = src.slice();
  const b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    boxLine(a, b, size, r, edge, 1, size);
    boxLine(b, a, size, r, edge, size, 1);
  }
  return a;
}

/** One box pass along every line: `step` between neighbours in a line, `stride` between lines. */
function boxLine(src: Float32Array, dst: Float32Array, size: number, r: number, edge: number, step: number, stride: number): void {
  const n = 2 * r + 1;
  for (let line = 0; line < size; line++) {
    const base = line * stride;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += k < 0 || k >= size ? edge : src[base + k * step];
    for (let k = 0; k < size; k++) {
      dst[base + k * step] = sum / n;
      const add = k + r + 1;
      const drop = k - r;
      sum += (add < size ? src[base + add * step] : edge) - (drop >= 0 ? src[base + drop * step] : edge);
    }
  }
}

/**
 * How far each painted pixel (alpha ≥ ½) is from the nearest unpainted one,
 * in pixels (Felzenszwalb and Huttenlocher's exact distance transform).
 * Outside the picture counts as unpainted (or, with `outsidePainted`, as
 * painted). Unpainted pixels get 0.
 */
export function insideDistance(alpha: Float32Array, size: number, outsidePainted = false): Float32Array {
  const n = size + 2;
  const INF = 1e20;
  const f = new Float64Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const inside = x > 0 && y > 0 && x <= size && y <= size ? alpha[(y - 1) * size + (x - 1)] >= 0.5 : outsidePainted;
      f[y * n + x] = inside ? INF : 0;
    }
  const line = new Float64Array(n);
  const out = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const pass = (stride: number, step: number) => {
    for (let l = 0; l < n; l++) {
      for (let k = 0; k < n; k++) line[k] = f[l * stride + k * step];
      edt1d(line, n, out, v, z);
      for (let k = 0; k < n; k++) f[l * stride + k * step] = out[k];
    }
  };
  pass(n, 1);
  pass(1, n);
  const d = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      // Half a pixel is the edge itself; a soft edge pixel sits partly outside.
      d[i] = alpha[i] >= 0.5 ? Math.max(0, Math.sqrt(f[(y + 1) * n + x + 1]) - 1 + alpha[i]) : 0;
    }
  return d;
}

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

// ---------------------------------------------------------------- noise

/** A repeatable random number in [0, 1) for a lattice point. */
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Fractal noise, roughly 0–1. */
export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x, y, seed + o * 131);
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / norm;
}

/** Cell noise: the distances to the nearest and second-nearest of one random point per cell (or a staggered grid, if `regular`). */
function cells(x: number, y: number, seed: number, regular = false): [number, number] {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i;
      const cy = iy + j;
      const px = regular ? cx + 0.5 + (cy & 1 ? 0.5 : 0) : cx + hash(cx, cy, seed);
      const py = regular ? cy + 0.5 : cy + hash(cx, cy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) f2 = d;
    }
  return [f1, f2];
}

/**
 * A procedural surface's height at (x, y) in cell units, about −1…1.
 * `polar` gives the position round the token, for the brushed finish.
 */
export function surfaceHeight(surface: Surface, x: number, y: number, seed: number, polar: { along: number; r: number }): number {
  switch (surface) {
    case 'smooth':
      return 0;
    case 'hammered': {
      // Overlapping round dents, ridges where they meet.
      const [f1] = cells(x * 1.2, y * 1.2, seed);
      return f1 * f1 * 2 - 0.6 + (fbm(x * 3, y * 3, seed + 5, 2) - 0.5) * 0.3;
    }
    case 'grain':
      return (fbm(x * 1.5, y * 1.5, seed) - 0.5) * 2.4;
    case 'brushed':
      // Fine streaks running round the token.
      return (fbm(polar.along * 0.25, polar.r * 9, seed, 3) - 0.5) * 2.2;
    case 'cracked': {
      const [f1, f2] = cells(x * 0.8, y * 0.8, seed);
      const crack = 1 - smooth(0, 0.09, f2 - f1);
      return -crack * 1.4 + (fbm(x * 2, y * 2, seed + 3, 2) - 0.5) * 0.4;
    }
    case 'scales': {
      const [f1] = cells(x * 1.3, y * 1.3, seed, true);
      return Math.sqrt(Math.max(0, 1 - (f1 * f1) / 0.42)) * 1.6 - 0.6;
    }
  }
}

// ---------------------------------------------------------------- bevel

function profile(p: BevelProfile, t: number): number {
  switch (p) {
    case 'rounded':
      return Math.sqrt(1 - (1 - t) * (1 - t));
    case 'chisel':
      return t;
    case 'cove':
      return 1 - Math.sqrt(1 - t * t);
    case 'ridge':
      // A rim along the edge, the middle left low (like a coin's).
      return t >= 1 ? 0 : Math.sin(Math.PI * t);
    case 'stepped': {
      const s = t * 3;
      const i = Math.min(2, Math.floor(s));
      return (i + smooth(0.55, 1, s - i)) / 3;
    }
  }
}

/** The light as a unit vector in 3D (+z towards the viewer), from the stage's light and a height above the band. */
export function light3d(light: number, heightDeg: number): [number, number, number] {
  const v = lightVector(light);
  const el = (heightDeg * Math.PI) / 180;
  return [v.x * Math.cos(el), v.y * Math.cos(el), Math.sin(el)];
}

/** The bevel's height map, in pixels (raised positive). */
export function bevelHeight(alpha: Float32Array, size: number, e: BevelEffect, env: EffectEnv): Float32Array {
  const dist = insideDistance(alpha, size);
  const S = Math.max(1, e.size * env.bw);
  const H = new Float32Array(alpha.length);
  const sign = e.direction === 'sunken' ? -1 : 1;
  const cell = Math.max(2, e.surfaceScale * env.bw);
  const bump = e.surface === 'smooth' ? 0 : e.surfaceDepth * cell * 0.3;
  const half = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (alpha[i] <= 0) continue;
      const t = clamp01(dist[i] / S);
      let h = profile(e.profile, t) * S * e.depth * sign;
      if (bump) {
        const dx = x - half;
        const dy = y - half;
        const r = Math.hypot(dx, dy);
        h += bump * surfaceHeight(e.surface, x / cell, y / cell, e.seed, { along: (Math.atan2(dy, dx) * r) / cell, r: r / cell });
      }
      H[i] = h * Math.min(1, alpha[i] * 2);
    }
  // Always a little, so the pixel steps of the edge don't show as streaks.
  const soften = Math.max(e.soften * env.bw, 2 + S * 0.05);
  return blur(H, size, soften);
}

function bevel(px: Uint8ClampedArray, size: number, e: BevelEffect, env: EffectEnv): void {
  const alpha = alphaOf(px);
  const H = bevelHeight(alpha, size, e, env);
  if (env.height) for (let i = 0; i < H.length; i++) H[i] += env.height[i];
  if (env.view === 'height' || env.view === 'normals') return showMaps(px, alpha, H, size, env, env.view);
  const [lx, ly, lz] = light3d(env.light, e.lightHeight);
  // Half-way between the light and the viewer, for the shine.
  const hl = Math.hypot(lx, ly, lz + 1);
  const hx = lx / hl;
  const hy = ly / hl;
  const hz = (lz + 1) / hl;
  const shin = 8 + e.gloss * e.gloss * 120;
  const flatSpec = Math.pow(hz, shin);
  const [hr, hg, hb] = rgbOf(e.highlight);
  let [sr, sg, sb] = rgbOf(e.shadow);
  // The rig: shaded sides take on the ambient colour; more lights add their colour where they fall.
  if (env.rig && env.rig.ambientStrength > 0) {
    const [ar, ag, ab] = rgbOf(env.rig.ambient);
    const k = env.rig.ambientStrength;
    [sr, sg, sb] = [sr + (ar - sr) * k, sg + (ag - sg) * k, sb + (ab - sb) * k];
  }
  const extra = (env.rig?.lights ?? []).map((l) => {
    const [x, y, z] = light3d(l.angle, l.height);
    return { x, y, z, rgb: rgbOf(l.color), strength: l.strength };
  });
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (alpha[i] <= 0) continue;
      const gx = (H[x < size - 1 ? i + 1 : i] - H[x > 0 ? i - 1 : i]) / 2;
      const gy = (H[y < size - 1 ? i + size : i] - H[y > 0 ? i - size : i]) / 2;
      const nl = Math.hypot(gx, gy, 1);
      const nx = -gx / nl;
      const ny = -gy / nl;
      const nz = 1 / nl;
      const diffuse = nx * lx + ny * ly + nz * lz;
      const delta = diffuse - lz;
      const lit = delta > 0 ? clamp01(delta / Math.max(0.05, 1 - lz)) * e.highlightOpacity : 0;
      const dark = delta < 0 ? clamp01(-delta / Math.max(0.05, lz)) * e.shadowOpacity : 0;
      const s = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), shin);
      const shine = e.gloss > 0 ? clamp01((s - flatSpec) / (1 - flatSpec)) * e.gloss : 0;
      const p = i * 4;
      let r = px[p];
      let g = px[p + 1];
      let b = px[p + 2];
      if (dark) {
        r += (sr - r) * dark;
        g += (sg - g) * dark;
        b += (sb - b) * dark;
      }
      const k = clamp01(lit + shine);
      if (k) {
        r += (hr - r) * k;
        g += (hg - g) * k;
        b += (hb - b) * k;
      }
      for (const l of extra) {
        // Only where it lights more than it lights a flat surface: a rim of colour on the edges facing it.
        const d = nx * l.x + ny * l.y + nz * l.z - l.z;
        if (d <= 0) continue;
        const a = clamp01((d / Math.max(0.05, 1 - l.z)) * l.strength);
        r += (l.rgb[0] - r) * a;
        g += (l.rgb[1] - g) * a;
        b += (l.rgb[2] - b) * a;
      }
      px[p] = r;
      px[p + 1] = g;
      px[p + 2] = b;
    }
}

/**
 * Fine scratches (version 7): thin bright lines with a dark edge beside
 * them, in seeded random directions, only on painted pixels.
 */
function scratch(px: Uint8ClampedArray, size: number, e: WearEffect, cell: number): void {
  let painted = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i]) painted++;
  const count = Math.round((e.scratches * painted * 3) / (cell * cell));
  let h = (e.seed * 2654435761 + 0x5c2a7c) >>> 0;
  const random = () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = (h + 0x6d2b79f5) >>> 0;
    return (h >>> 8) / 16777216;
  };
  for (let k = 0; k < count; k++) {
    const x0 = random() * size;
    const y0 = random() * size;
    const a = random() * Math.PI;
    const len = cell * (0.4 + random() * 1.4);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const strength = 0.25 + random() * 0.45;
    // Walk along the scratch a pixel at a time: lighten its line and darken the pixel beside it.
    for (let t = 0; t < len; t += 0.7) {
      const x = Math.round(x0 + dx * t);
      const y = Math.round(y0 + dy * t);
      if (x < 1 || y < 1 || x >= size - 1 || y >= size - 1) continue;
      const fade = Math.sin((Math.PI * t) / len) * strength;
      const p = (y * size + x) * 4;
      if (!px[p + 3]) continue;
      px[p] += (255 - px[p]) * fade * 0.6;
      px[p + 1] += (255 - px[p + 1]) * fade * 0.6;
      px[p + 2] += (255 - px[p + 2]) * fade * 0.6;
      const q = ((y + Math.round(dx)) * size + x - Math.round(dy)) * 4;
      if (px[q + 3]) {
        px[q] *= 1 - fade * 0.45;
        px[q + 1] *= 1 - fade * 0.45;
        px[q + 2] *= 1 - fade * 0.45;
      }
    }
  }
}

// ---------------------------------------------------------------- distortion

/**
 * Moves every pixel by smooth noise (sizes in band widths), sampling the
 * picture between pixels (premultiplied, so edges don't fringe).
 */
function distort(px: Uint8ClampedArray, size: number, e: DistortEffect, env: EffectEnv): void {
  const amount = e.amount * env.bw;
  if (amount < 0.05) return;
  const cell = Math.max(2, e.scale * env.bw);
  const src = new Float32Array(px.length);
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3] / 255;
    src[i] = px[i] * a;
    src[i + 1] = px[i + 1] * a;
    src[i + 2] = px[i + 2] * a;
    src[i + 3] = px[i + 3];
  }
  const at = (x: number, y: number, c: number) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : src[(y * size + x) * 4 + c]);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / cell;
      const v = y / cell;
      const sx = x + (fbm(u, v, e.seed + 101, 3) - 0.5) * 2 * amount;
      const sy = y + (fbm(u, v, e.seed + 211, 3) - 0.5) * 2 * amount;
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const fx = sx - ix;
      const fy = sy - iy;
      const p = (y * size + x) * 4;
      const out = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        const top = at(ix, iy, c) * (1 - fx) + at(ix + 1, iy, c) * fx;
        const bottom = at(ix, iy + 1, c) * (1 - fx) + at(ix + 1, iy + 1, c) * fx;
        out[c] = top * (1 - fy) + bottom * fy;
      }
      const a = out[3] / 255;
      px[p + 3] = out[3];
      if (a > 0) {
        px[p] = out[0] / a;
        px[p + 1] = out[1] / a;
        px[p + 2] = out[2] / a;
      }
    }
}

// ---------------------------------------------------------------- shadow and glow

/** Puts a coloured layer of coverage `cover` (0–1) behind the picture. */
function behind(px: Uint8ClampedArray, cover: Float32Array, rgb: [number, number, number]): void {
  for (let i = 0; i < cover.length; i++) {
    const g = cover[i];
    if (g <= 0) continue;
    const p = i * 4;
    const a = px[p + 3] / 255;
    const out = a + g * (1 - a);
    if (out <= 0) continue;
    const k = (g * (1 - a)) / out;
    px[p] += (rgb[0] - px[p]) * k;
    px[p + 1] += (rgb[1] - px[p + 1]) * k;
    px[p + 2] += (rgb[2] - px[p + 2]) * k;
    px[p + 3] = out * 255;
  }
}

/** Tints the painted pixels towards `rgb` by `amount` (0–1), keeping their alpha. */
function within(px: Uint8ClampedArray, amount: Float32Array, rgb: [number, number, number]): void {
  for (let i = 0; i < amount.length; i++) {
    const k = amount[i];
    if (k <= 0) continue;
    const p = i * 4;
    if (!px[p + 3]) continue;
    px[p] += (rgb[0] - px[p]) * k;
    px[p + 1] += (rgb[1] - px[p + 1]) * k;
    px[p + 2] += (rgb[2] - px[p + 2]) * k;
  }
}

/** `src` moved by (dx, dy) pixels; uncovered pixels get `edge`. */
function shifted(src: Float32Array, size: number, dx: number, dy: number, edge: number): Float32Array {
  const ox = Math.round(dx);
  const oy = Math.round(dy);
  if (!ox && !oy) return src;
  const out = new Float32Array(src.length);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = x - ox;
      const sy = y - oy;
      out[y * size + x] = sx < 0 || sy < 0 || sx >= size || sy >= size ? edge : src[sy * size + sx];
    }
  return out;
}

function shadow(px: Uint8ClampedArray, size: number, e: ShadowEffect, env: EffectEnv): void {
  const alpha = alphaOf(px);
  const v = lightVector(env.light);
  // Away from the light.
  const dx = -v.x * e.distance * env.bw;
  const dy = -v.y * e.distance * env.bw;
  const rgb = rgbOf(e.color);
  if (!e.inner) {
    const cover = blur(shifted(alpha, size, dx, dy, 0), size, e.blur * env.bw);
    for (let i = 0; i < cover.length; i++) cover[i] *= e.opacity;
    behind(px, cover, rgb);
    return;
  }
  // Inside: the edge facing the light casts its shadow in.
  const outside = new Float32Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) outside[i] = 1 - alpha[i];
  const cover = blur(shifted(outside, size, dx, dy, 1), size, e.blur * env.bw, 1);
  for (let i = 0; i < cover.length; i++) cover[i] = clamp01(cover[i]) * e.opacity;
  within(px, cover, rgb);
}

/**
 * A glow fades with the distance from the edge (outside it, or inside it),
 * so thin runes glow as brightly as a whole band.
 */
function glow(px: Uint8ClampedArray, size: number, e: GlowEffect, env: EffectEnv): void {
  const alpha = alphaOf(px);
  const rgb = rgbOf(e.color);
  const r = Math.max(1, e.size * env.bw);
  const from = e.inner ? alpha : alpha.map((a) => 1 - a);
  // Painted pixels are all distance 0 from themselves (outer), so they are fully covered (and the glow is behind them).
  const dist = insideDistance(from, size, !e.inner);
  const cover = new Float32Array(alpha.length);
  for (let i = 0; i < cover.length; i++) {
    if (e.inner ? alpha[i] <= 0 : alpha[i] >= 1) continue;
    const t = 1 - clamp01(dist[i] / r);
    cover[i] = Math.pow(t, 1.6) * e.opacity;
  }
  // A little softening, so the glow has no hard rings.
  const soft = blur(cover, size, Math.min(r * 0.3, 6));
  if (e.inner) within(px, soft, rgb);
  else behind(px, soft, rgb);
}

// ---------------------------------------------------------------- colour

/** 256 colours, dark to light, from gradient stops (with each stop's opacity as how much it shows). */
export function gradientTable(stops: GradientStop[]): Float32Array {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  const table = new Float32Array(256 * 4);
  const rgbs = sorted.map((s) => rgbOf(s.color));
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = sorted.findIndex((s) => s.at >= t);
    if (k === -1) k = sorted.length - 1;
    const a = Math.max(0, k - 1);
    const span = sorted[k].at - sorted[a].at;
    const f = k === a || span <= 0 ? (t >= sorted[k].at ? 1 : 0) : clamp01((t - sorted[a].at) / span);
    const fromA = k === a ? 0 : 1 - f;
    for (let c = 0; c < 3; c++) table[i * 4 + c] = rgbs[a][c] * fromA + rgbs[k][c] * (1 - fromA);
    table[i * 4 + 3] = sorted[a].opacity * fromA + sorted[k].opacity * (1 - fromA);
  }
  return table;
}

function recolour(px: Uint8ClampedArray, e: RecolourEffect): void {
  const table = gradientTable(e.stops);
  for (let p = 0; p < px.length; p += 4) {
    if (!px[p + 3]) continue;
    const l = Math.round(0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2]);
    const t = l * 4;
    const k = e.amount * table[t + 3];
    px[p] += (table[t] - px[p]) * k;
    px[p + 1] += (table[t + 1] - px[p + 1]) * k;
    px[p + 2] += (table[t + 2] - px[p + 2]) * k;
  }
}

function adjust(px: Uint8ClampedArray, e: AdjustEffect): void {
  // The hue turn as a colour matrix (as CSS's hue-rotate), mixed with grey for the saturation.
  const a = (e.hue * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  const sat = 1 + e.saturation;
  const contrast = 1 + e.contrast;
  const bright = e.brightness * 128;
  for (let p = 0; p < px.length; p += 4) {
    if (!px[p + 3]) continue;
    let r = px[p];
    let g = px[p + 1];
    let b = px[p + 2];
    if (e.hue) {
      const r0 = r;
      const g0 = g;
      r = m[0] * r0 + m[1] * g0 + m[2] * b;
      g = m[3] * r0 + m[4] * g0 + m[5] * b;
      b = m[6] * r0 + m[7] * g0 + m[8] * b;
    }
    const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = (grey + (r - grey) * sat + bright - 128) * contrast + 128;
    g = (grey + (g - grey) * sat + bright - 128) * contrast + 128;
    b = (grey + (b - grey) * sat + bright - 128) * contrast + 128;
    px[p] = r;
    px[p + 1] = g;
    px[p + 2] = b;
  }
}

// ---------------------------------------------------------------- wear

function wear(px: Uint8ClampedArray, size: number, e: WearEffect, env: EffectEnv): void {
  const alpha = alphaOf(px);
  const dist = insideDistance(alpha, size);
  const cell = Math.max(2, e.scale * env.bw);
  const reach = cell * 0.8;
  const [gr, gg, gb] = rgbOf(e.grimeColor);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const p = i * 4;
      if (!px[p + 3]) continue;
      const u = x / cell;
      const v = y / cell;
      // 1 on the edge, 0 a little way in.
      const edge = 1 - clamp01(dist[i] / reach);
      if (e.chips > 0) {
        const bite = edge * (0.4 + 1.2 * fbm(u * 1.1, v * 1.1, e.seed + 11, 2)) - (1.3 - e.chips);
        if (bite > 0) px[p + 3] *= 1 - smooth(0, 0.08, bite);
      }
      let r = px[p];
      let g = px[p + 1];
      let b = px[p + 2];
      if (e.polish > 0) {
        const k = edge * edge * e.polish * 0.7 * (0.6 + 0.8 * fbm(u * 3, v * 3, e.seed + 23, 2));
        r += (255 - r) * k * 0.6;
        g += (255 - g) * k * 0.6;
        b += (255 - b) * k * 0.6;
      }
      if (e.grime > 0) {
        const n = fbm(u * 0.9, v * 0.9, e.seed + 37);
        const k = smooth(0.62 - e.grime * 0.3, 0.85, n) * (1 - edge * 0.6) * e.grime * 0.9;
        r += (gr - r) * k;
        g += (gg - g) * k;
        b += (gb - b) * k;
      }
      px[p] = r;
      px[p + 1] = g;
      px[p + 2] = b;
    }
  if (e.scratches > 0) scratch(px, size, e, cell);
}

// ---------------------------------------------------------------- views, sides and offset (version 8)

/** Writes a bevel's height map (grey: mid-grey flat, lighter higher) or its normal map (RGB = x, y, z) over the picture. */
function showMaps(px: Uint8ClampedArray, alpha: Float32Array, H: Float32Array, size: number, env: EffectEnv, view: 'height' | 'normals'): void {
  const unit = Math.max(1, env.bw * 0.25);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (alpha[i] <= 0) continue;
      const p = i * 4;
      if (view === 'height') {
        const v = clamp01(0.5 + H[i] / unit / 2) * 255;
        px[p] = px[p + 1] = px[p + 2] = v;
        continue;
      }
      const gx = (H[x < size - 1 ? i + 1 : i] - H[x > 0 ? i - 1 : i]) / 2;
      const gy = (H[y < size - 1 ? i + size : i] - H[y > 0 ? i - size : i]) / 2;
      const nl = Math.hypot(gx, gy, 1);
      px[p] = (0.5 - gx / nl / 2) * 255;
      px[p + 1] = (0.5 - gy / nl / 2) * 255;
      px[p + 2] = (0.5 + 1 / nl / 2) * 255;
    }
}

/** A shape height map for a layer in a shared height map: its distance from its own edge through a rounded profile, `depth` high. */
export function heightContribution(alpha: Float32Array, size: number, sizeBw: number, depth: number, bw: number): Float32Array {
  const dist = insideDistance(alpha, size);
  const S = Math.max(1, sizeBw * bw);
  const H = new Float32Array(alpha.length);
  for (let i = 0; i < H.length; i++) if (alpha[i] > 0) H[i] = profile('rounded', clamp01(dist[i] / S)) * S * depth * Math.min(1, alpha[i] * 2);
  return H;
}

/**
 * Sides: the picture pushed back away from the light a pixel at a time,
 * each step darker, put behind it, so it looks like a thick plate.
 */
function extrude(px: Uint8ClampedArray, size: number, e: ExtrudeEffect, env: EffectEnv): void {
  const n = Math.round(e.depth * env.bw);
  if (n < 1) return;
  const v = lightVector(env.light);
  const back = new Float32Array(px.length);
  for (let k = n; k >= 1; k--) {
    const dx = Math.round(-v.x * k);
    const dy = Math.round(-v.y * k);
    const dark = 1 - e.shade * (0.55 + 0.45 * (k / n));
    for (let y = 0; y < size; y++) {
      const sy = y - dy;
      if (sy < 0 || sy >= size) continue;
      for (let x = 0; x < size; x++) {
        const sx = x - dx;
        if (sx < 0 || sx >= size) continue;
        const q = (sy * size + sx) * 4;
        const a = px[q + 3] / 255;
        if (a <= 0) continue;
        const p = (y * size + x) * 4;
        // Over what is already behind (premultiplied).
        back[p] = px[q] * dark * a + back[p] * (1 - a);
        back[p + 1] = px[q + 1] * dark * a + back[p + 1] * (1 - a);
        back[p + 2] = px[q + 2] * dark * a + back[p + 2] * (1 - a);
        back[p + 3] = a + back[p + 3] * (1 - a);
      }
    }
  }
  for (let p = 0; p < px.length; p += 4) {
    const a = px[p + 3] / 255;
    const b = back[p + 3] * (1 - a);
    const out = a + b;
    if (out <= 0 || a >= 1) continue;
    for (let c = 0; c < 3; c++) px[p + c] = (px[p + c] * a + back[p + c] * (1 - a)) / out;
    px[p + 3] = out * 255;
  }
}

/** Grows the shape by `amount` band widths (new pixels take their neighbours' colour) or shrinks it. */
function offset(px: Uint8ClampedArray, size: number, e: OffsetEffect, env: EffectEnv): void {
  const d = e.amount * env.bw;
  if (Math.abs(d) < 0.25) return;
  const alpha = alphaOf(px);
  if (d < 0) {
    const inside = insideDistance(alpha, size);
    for (let i = 0; i < alpha.length; i++) if (alpha[i] > 0) px[i * 4 + 3] = alpha[i] * clamp01(inside[i] + d + 0.5) * 255;
    return;
  }
  const outside = insideDistance(alpha.map((a) => 1 - a), size, true);
  // Spread the colours outwards a ring at a time, so a new pixel takes the colour of the painted ones beside it.
  const colour = new Float32Array(px.length);
  const known = new Uint8Array(alpha.length);
  for (let i = 0; i < alpha.length; i++)
    if (alpha[i] > 0) {
      known[i] = 1;
      for (let c = 0; c < 3; c++) colour[i * 4 + c] = px[i * 4 + c];
    }
  for (let step = 0; step < Math.ceil(d) + 1; step++) {
    const add: number[] = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (known[i] || outside[i] > d + 1) continue;
        let n = 0;
        const sum = [0, 0, 0];
        for (const j of [i - 1, i + 1, i - size, i + size]) {
          if (j < 0 || j >= known.length || !known[j] || Math.abs((j % size) - x) > 1) continue;
          n++;
          for (let c = 0; c < 3; c++) sum[c] += colour[j * 4 + c];
        }
        if (n) {
          add.push(i);
          for (let c = 0; c < 3; c++) colour[i * 4 + c] = sum[c] / n;
        }
      }
    if (!add.length) break;
    for (const i of add) known[i] = 1;
  }
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] >= 1 || !known[i]) continue;
    const grown = clamp01(d - outside[i] + 0.5);
    const a = Math.max(alpha[i], grown);
    if (a <= alpha[i]) continue;
    const p = i * 4;
    for (let c = 0; c < 3; c++) px[p + c] = alpha[i] > 0 ? px[p + c] : colour[p + c];
    px[p + 3] = a * 255;
  }
}

// ---------------------------------------------------------------- bloom and bleed (version 9)

/**
 * Over the whole design: bloom (a soft glow round its brightest parts) and
 * bleed (its colours spilling onto their neighbours), both added like light
 * (screen), sized in band widths.
 */
export function lightPass(ctx: Ctx, size: number, bloom: number, bleed: number, bw: number): void {
  if (bloom <= 0 && bleed <= 0) return;
  const image = ctx.getImageData(0, 0, size, size);
  const px = image.data;
  const n = size * size;
  const add = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const pass = (weight: (r: number, g: number, b: number, a: number) => number, radius: number, amount: number) => {
    const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      const a = px[p + 3] / 255;
      if (!a) continue;
      const w = weight(px[p] / 255, px[p + 1] / 255, px[p + 2] / 255, a);
      for (let c = 0; c < 3; c++) ch[c][i] = (px[p + c] / 255) * w;
    }
    for (let c = 0; c < 3; c++) {
      const blurred = blur(ch[c], size, radius);
      for (let i = 0; i < n; i++) add[c][i] += blurred[i] * amount;
    }
  };
  if (bloom > 0) pass((r, g, b, a) => clamp01((0.2126 * r + 0.7152 * g + 0.0722 * b - 0.6) / 0.4) * a, Math.max(2, bw * 0.3), bloom * 1.6);
  if (bleed > 0)
    pass(
      (r, g, b, a) => {
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        // Bright, vivid colours spill the most.
        return (mx - mn) * mx * a;
      },
      Math.max(3, bw * 0.6),
      bleed * 1.2,
    );
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const a = px[p + 3] / 255;
    let lightA = 0;
    for (let c = 0; c < 3; c++) lightA = Math.max(lightA, clamp01(add[c][i]));
    if (lightA <= 0) continue;
    // Screen the added light over the pixel (premultiplied), so it can also shine past the design's edge.
    const out = a + lightA * (1 - a);
    for (let c = 0; c < 3; c++) {
      const base = (px[p + c] / 255) * a;
      const light = clamp01(add[c][i]);
      const v = 1 - (1 - base) * (1 - light);
      px[p + c] = clamp01(v / out) * 255;
    }
    px[p + 3] = out * 255;
  }
  ctx.putImageData(image, 0, 0);
}
