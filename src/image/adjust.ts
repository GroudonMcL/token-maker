// Image adjustments (DESIGN.md §6.2) as plain pixel maths, so they look the
// same in every browser (canvas `filter` is missing in Safari) and in tests.
// Brightness, contrast and saturation follow the extension's formulas.

import type { ImageAdjustments } from '../document/types';

export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function isNeutral(a: ImageAdjustments): boolean {
  return (
    !a.invert &&
    a.brightness === 0 &&
    a.contrast === 0 &&
    a.saturation === 0 &&
    a.hue === 0 &&
    a.temperature === 0 &&
    a.tint === 0 &&
    a.exposure === 0 &&
    a.highlights === 0 &&
    a.shadows === 0 &&
    a.sharpness === 0 &&
    a.blur === 0 &&
    a.vibrance === 0 &&
    a.grayscale === 0 &&
    a.sepia === 0
  );
}

/**
 * Blur radius in pixels. It is a share of the image's longer side, so a
 * low-resolution preview and the full-size export look the same.
 */
export const blurRadius = (a: ImageAdjustments, longSide: number) => (a.blur / 100) * longSide * 0.02;
const sharpenRadius = (longSide: number) => Math.max(1, longSide * 0.0012);

const toLinear = new Float32Array(256).map((_v, i) => (i / 255) ** 2.2);
const toByte = (linear: number) => 255 * Math.max(0, linear) ** (1 / 2.2);

/** Per-channel look-up tables: white balance → exposure → brightness → contrast. */
function channelTables(a: ImageAdjustments): [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray] {
  const t = a.temperature / 100;
  const m = a.tint / 100;
  // Warm adds red and takes blue; magenta tint takes green.
  const gains = [1 + 0.2 * t + 0.08 * m, 1 + 0.04 * t - 0.16 * m, 1 - 0.2 * t + 0.08 * m];
  const exposure = 2 ** ((a.exposure / 100) * 2);
  const brightness = (a.brightness / 100) * 255 * 0.5;
  const c = (a.contrast / 100) * 255 * 0.9;
  const contrast = (259 * (c + 255)) / (255 * (259 - c));
  return gains.map((gain) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      let x = gain === 1 && exposure === 1 ? v : toByte(toLinear[v]! * gain * exposure);
      x = contrast * (x + brightness - 128) + 128;
      lut[v] = Math.round(x);
    }
    return lut;
  }) as [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray];
}

/** CSS-style hue rotation matrix. */
function hueMatrix(deg: number): number[] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
}

/**
 * Returns the adjusted pixels as a new buffer (the input is never changed).
 * Order: channel tables, highlights/shadows, hue, saturation, vibrance,
 * grayscale, sepia, invert, then blur and sharpness.
 */
export function adjustPixels(src: PixelBuffer, a: ImageAdjustments): PixelBuffer {
  const { width: w, height: h } = src;
  const d = new Uint8ClampedArray(src.data);
  const out = { data: d, width: w, height: h };
  if (isNeutral(a)) return out;

  const [lr, lg, lb] = channelTables(a);
  const hs = a.highlights !== 0 || a.shadows !== 0;
  const hue = a.hue !== 0 ? hueMatrix(a.hue) : null;
  const sat = 1 + a.saturation / 100;
  const vib = a.vibrance / 100;
  const gray = a.grayscale / 100;
  const sepia = a.sepia / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r: number = lr[d[i]!]!;
    let g: number = lg[d[i + 1]!]!;
    let b: number = lb[d[i + 2]!]!;
    if (hs) {
      // Shadows lift or deepen the dark tones, highlights the light ones; hue is kept.
      const l = Math.max(1, 0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const delta = (a.shadows / 100) * 0.35 * (1 - l) ** 2 + (a.highlights / 100) * 0.35 * l ** 2;
      const k = Math.max(0, l + delta) / l;
      r *= k;
      g *= k;
      b *= k;
    }
    if (hue) {
      const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = hue as [number, number, number, number, number, number, number, number, number];
      const nr = m0 * r + m1 * g + m2 * b;
      const ng = m3 * r + m4 * g + m5 * b;
      b = m6 * r + m7 * g + m8 * b;
      r = nr;
      g = ng;
    }
    if (sat !== 1) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * sat;
      g = y + (g - y) * sat;
      b = y + (b - y) * sat;
    }
    if (vib !== 0) {
      // Like saturation, but mostly for colours that are still dull.
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const k = 1 + vib * (1 - Math.min(1, Math.max(0, (max - min) / 255)));
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r = y + (r - y) * k;
      g = y + (g - y) * k;
      b = y + (b - y) * k;
    }
    if (gray > 0) {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      r += (y - r) * gray;
      g += (y - g) * gray;
      b += (y - b) * gray;
    }
    if (sepia > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * sepia;
      g += (sg - g) * sepia;
      b += (sb - b) * sepia;
    }
    if (a.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }

  const long = Math.max(w, h);
  const blur = blurRadius(a, long);
  if (blur > 0) gaussianish(out, blur);
  if (a.sharpness > 0) {
    // Unsharp mask: push each pixel away from its blurred neighbourhood.
    const soft = { data: new Uint8ClampedArray(d), width: w, height: h };
    gaussianish(soft, sharpenRadius(long));
    const amount = (a.sharpness / 100) * 2;
    const s = soft.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i]! + (d[i]! - s[i]!) * amount;
      d[i + 1] = d[i + 1]! + (d[i + 1]! - s[i + 1]!) * amount;
      d[i + 2] = d[i + 2]! + (d[i + 2]! - s[i + 2]!) * amount;
    }
  }
  return out;
}

/**
 * Three box blurs in a row, which look close to a Gaussian blur of the given
 * radius. Colours are premultiplied by alpha first so transparent pixels
 * don't bleed dark edges.
 */
export function gaussianish(buf: PixelBuffer, radius: number): void {
  const { data: d, width: w, height: h } = buf;
  const r = Math.max(1, Math.round(radius / Math.sqrt(3)));
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]! / 255;
    d[i] = d[i]! * a;
    d[i + 1] = d[i + 1]! * a;
    d[i + 2] = d[i + 2]! * a;
  }
  const tmp = new Uint8ClampedArray(d.length);
  for (let pass = 0; pass < 3; pass++) {
    boxPass(d, tmp, w, h, r, true);
    boxPass(tmp, d, w, h, r, false);
  }
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a === 0) continue;
    const k = 255 / a;
    d[i] = d[i]! * k;
    d[i + 1] = d[i + 1]! * k;
    d[i + 2] = d[i + 2]! * k;
  }
}

/** One box blur along rows (horizontal) or columns, with the edges extended. */
function boxPass(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, horizontal: boolean): void {
  const lines = horizontal ? h : w;
  const len = horizontal ? w : h;
  const step = horizontal ? 4 : w * 4;
  const size = r * 2 + 1;
  for (let line = 0; line < lines; line++) {
    const start = horizontal ? line * w * 4 : line * 4;
    for (let c = 0; c < 4; c++) {
      const at = (k: number) => src[start + Math.min(len - 1, Math.max(0, k)) * step + c]!;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += at(k);
      for (let k = 0; k < len; k++) {
        dst[start + k * step + c] = sum / size;
        sum += at(k + r + 1) - at(k - r);
      }
    }
  }
}
