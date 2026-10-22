// Flat-colour background removal (DESIGN.md §6.2), ported from the
// extension. Instead of making pixels transparent it returns a mask (255 =
// keep, 0 = removed), so the original image is never changed and the brush
// can fix the result later.

import type { BackgroundRemoval } from '../document/types';
import { parseHex, toHex } from '../render/color';
import type { PixelBuffer } from './adjust';

type Rgb = [number, number, number];

const dist = (d: Uint8ClampedArray, i: number, ref: Rgb) => Math.hypot(d[i]! - ref[0], d[i + 1]! - ref[1], d[i + 2]! - ref[2]);

/** Colour distance below which a pixel counts as background, from the Intensity slider. */
export const removalThreshold = (intensity: number) => Math.max(1, (intensity / 100) * 180);

/** The background colour: the corner colour most other corners agree with. */
export function detectBackground(buf: PixelBuffer, intensity = 20): string {
  const { data: d, width: w, height: h } = buf;
  if (!w || !h) return '#ffffff';
  const threshold = removalThreshold(intensity);
  const colors = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => [d[p * 4]!, d[p * 4 + 1]!, d[p * 4 + 2]!] as Rgb);
  let ref = colors[0]!;
  let best = -1;
  for (const c of colors) {
    const votes = colors.filter((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) <= threshold).length;
    if (votes > best) {
      best = votes;
      ref = c;
    }
  }
  return toHex({ r: ref[0], g: ref[1], b: ref[2] });
}

/**
 * Flood-fills from the image's edges (and from the eyedropper point, if any)
 * through pixels close to the background colour. Areas of the same colour
 * inside the subject that don't touch the background are kept. Pixels along
 * the cut fade by how close they are to the background colour, and Edge
 * softness blurs the cut inwards, never outwards, so no halo of background
 * is left around the subject.
 */
export function removalMask(buf: PixelBuffer, removal: BackgroundRemoval): Uint8Array {
  const { data: d, width: w, height: h } = buf;
  const mask = new Uint8Array(w * h).fill(255);
  if (!removal.enabled || !w || !h) return mask;
  const { r, g, b } = parseHex(removal.color ?? detectBackground(buf, removal.intensity));
  const ref: Rgb = [r, g, b];
  const threshold = removalThreshold(removal.intensity);
  const soft = threshold * (1.3 + (removal.softness / 100) * 1.2);

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (p: number) => {
    if (!visited[p] && d[p * 4 + 3]! > 0 && dist(d, p * 4, ref) <= threshold) {
      visited[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  if (removal.seed) {
    const sx = Math.min(w - 1, Math.max(0, Math.floor(removal.seed.x * w)));
    const sy = Math.min(h - 1, Math.max(0, Math.floor(removal.seed.y * h)));
    seed(sy * w + sx);
  }
  while (stack.length) {
    const p = stack.pop()!;
    mask[p] = 0;
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < w * (h - 1)) seed(p + w);
  }

  // Feather: pixels bordering the removed area fade according to similarity.
  for (let p = 0; p < w * h; p++) {
    if (visited[p]) continue;
    const x = p % w;
    const touches = (x > 0 && visited[p - 1]) || (x < w - 1 && visited[p + 1]) || (p >= w && visited[p - w]) || (p < w * (h - 1) && visited[p + w]);
    if (!touches) continue;
    const dd = dist(d, p * 4, ref);
    if (dd < soft) mask[p] = Math.round(255 * Math.min(1, Math.max(0.15, (dd - threshold) / (soft - threshold))));
  }

  const radius = Math.round((removal.softness / 100) * Math.max(w, h) * 0.004);
  if (radius >= 1) erodeSoftly(mask, w, h, radius);
  return mask;
}

/** Blurs the mask and keeps the lower value, so edges only soften inwards. */
function erodeSoftly(mask: Uint8Array, w: number, h: number, r: number): void {
  const a = new Float32Array(mask);
  const b = new Float32Array(a.length);
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const lines = horizontal ? h : w;
    const len = horizontal ? w : h;
    const step = horizontal ? 1 : w;
    for (let line = 0; line < lines; line++) {
      const start = horizontal ? line * w : line;
      const at = (k: number) => src[start + Math.min(len - 1, Math.max(0, k)) * step]!;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += at(k);
      for (let k = 0; k < len; k++) {
        dst[start + k * step] = sum / (2 * r + 1);
        sum += at(k + r + 1) - at(k - r);
      }
    }
  };
  pass(a, b, true);
  pass(b, a, false);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.min(mask[i]!, Math.round(a[i]!));
}
