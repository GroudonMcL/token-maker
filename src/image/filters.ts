// Blur and sharpen, sized relative to the image so a low-resolution preview
// and the full-size export look the same. Fast box blurs (three passes
// approximate a Gaussian), done on premultiplied colour so transparent
// pixels don't darken the edges.

import type { PixelBuffer } from './adjust';

/** Box radii for three passes approximating a Gaussian of this sigma. */
function boxRadii(sigma: number): number[] {
  const n = 3;
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return [0, 1, 2].map((i) => ((i < m ? wl : wu) - 1) / 2);
}

/** One box pass over `channels` interleaved channels, along rows (or columns). */
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, channels: number, r: number, vertical: boolean) {
  const len = vertical ? h : w;
  const lines = vertical ? w : h;
  const step = (vertical ? w : 1) * channels;
  const lineStep = (vertical ? 1 : w) * channels;
  const scale = 1 / (r + r + 1);
  const row = new Float32Array(len * channels);
  const acc = new Float64Array(channels);
  const last = len - 1;
  for (let line = 0; line < lines; line++) {
    const base = line * lineStep;
    for (let i = 0, p = base, q = 0; i < len; i++, p += step, q += channels) {
      for (let c = 0; c < channels; c++) row[q + c] = src[p + c]!;
    }
    // Edges repeat the end pixels.
    for (let c = 0; c < channels; c++) {
      let a = row[c]! * (r + 1);
      for (let i = 1; i <= r; i++) a += row[Math.min(i, last) * channels + c]!;
      acc[c] = a;
    }
    for (let i = 0, p = base; i < len; i++, p += step) {
      const add = (i + r + 1 > last ? last : i + r + 1) * channels;
      const sub = (i - r < 0 ? 0 : i - r) * channels;
      for (let c = 0; c < channels; c++) {
        dst[p + c] = acc[c]! * scale;
        acc[c] = acc[c]! + row[add + c]! - row[sub + c]!;
      }
    }
  }
}

/** Gaussian-like blur of interleaved float data, in place. */
export function blurFloat(data: Float32Array, w: number, h: number, channels: number, sigma: number): void {
  if (sigma < 0.3 || w === 0 || h === 0) return;
  const tmp = new Float32Array(data.length);
  for (const r of boxRadii(sigma)) {
    if (r < 1) continue;
    boxPass(data, tmp, w, h, channels, r, false);
    boxPass(tmp, data, w, h, channels, r, true);
  }
}

/** Blurs a 0–255 single-channel mask in place. */
export function blurMask(mask: Uint8Array, w: number, h: number, sigma: number): void {
  if (sigma < 0.3) return;
  const f = Float32Array.from(mask);
  blurFloat(f, w, h, 1, sigma);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.round(f[i]!);
}

function premultiplied(buf: PixelBuffer): Float32Array {
  const d = buf.data;
  const f = new Float32Array(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]! / 255;
    f[i] = d[i]! * a;
    f[i + 1] = d[i + 1]! * a;
    f[i + 2] = d[i + 2]! * a;
    f[i + 3] = d[i + 3]!;
  }
  return f;
}

/** Blurs an image in place; `sigma` is in pixels of this buffer. */
export function blurImage(buf: PixelBuffer, sigma: number): void {
  if (sigma < 0.3) return;
  const f = premultiplied(buf);
  blurFloat(f, buf.width, buf.height, 4, sigma);
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = f[i + 3]!;
    const k = a > 0 ? 255 / a : 0;
    d[i] = f[i]! * k;
    d[i + 1] = f[i + 1]! * k;
    d[i + 2] = f[i + 2]! * k;
    d[i + 3] = a;
  }
}

/** Unsharp mask in place: pushes each pixel away from its blurred surroundings. */
export function sharpenImage(buf: PixelBuffer, amount: number, sigma: number): void {
  if (amount <= 0) return;
  const f = premultiplied(buf);
  const blurred = f.slice();
  blurFloat(blurred, buf.width, buf.height, 4, Math.max(0.6, sigma));
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]!;
    if (a === 0) continue;
    const k = 255 / a;
    for (let c = 0; c < 3; c++) {
      const v = f[i + c]!;
      d[i + c] = (v + (v - blurred[i + c]!) * amount) * k;
    }
  }
}
