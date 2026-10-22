// Flat-colour background removal (DESIGN.md §6.2), ported from the
// extension: flood-fill from the image's edges through pixels close to the
// background colour. Areas of that colour not connected to an edge (e.g. a
// white shield) are kept. The result is a mask (255 = keep, 0 = removed), so
// the picture's own pixels are never changed.

import type { PixelBuffer } from './adjust';
import { blurMask } from './filters';

export type Rgb = [number, number, number];

export interface RemovalSettings {
  /** The colour to remove, or null to find it from the edges. */
  color: Rgb | null;
  /** 0–100. */
  intensity: number;
  /** 0–100. */
  softness: number;
}

const dist = (d: Uint8ClampedArray, i: number, ref: Rgb) => {
  const dr = d[i]! - ref[0];
  const dg = d[i + 1]! - ref[1];
  const db = d[i + 2]! - ref[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * The background colour: the most common colour around the image's edges
 * (colours are grouped into buckets, then the biggest bucket is averaged).
 */
export function detectEdgeColor(buf: PixelBuffer): Rgb {
  const { data: d, width: w, height: h } = buf;
  const counts = new Map<number, [number, number, number, number]>();
  const add = (p: number) => {
    const i = p * 4;
    if (d[i + 3]! < 128) return;
    const key = ((d[i]! >> 4) << 8) | ((d[i + 1]! >> 4) << 4) | (d[i + 2]! >> 4);
    const e = counts.get(key);
    if (e) {
      e[0]++;
      e[1] += d[i]!;
      e[2] += d[i + 1]!;
      e[3] += d[i + 2]!;
    } else counts.set(key, [1, d[i]!, d[i + 1]!, d[i + 2]!]);
  };
  for (let x = 0; x < w; x++) {
    add(x);
    add((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    add(y * w);
    add(y * w + w - 1);
  }
  let best: [number, number, number, number] | undefined;
  for (const e of counts.values()) if (!best || e[0] > best[0]) best = e;
  if (!best) return [255, 255, 255];
  return [Math.round(best[1] / best[0]), Math.round(best[2] / best[0]), Math.round(best[3] / best[0])];
}

/** Returns the keep-mask for the background removal. */
export function removalMask(buf: PixelBuffer, s: RemovalSettings): Uint8Array {
  const { data: d, width: w, height: h } = buf;
  const mask = new Uint8Array(w * h).fill(255);
  if (w === 0 || h === 0) return mask;
  const ref = s.color ?? detectEdgeColor(buf);
  // Same scale as the extension's tolerance (0–100 → colour distance 0–180).
  const threshold = Math.max(1, (s.intensity / 100) * 180);
  const soft = threshold * 1.6;

  const removed = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (p: number) => {
    if (!removed[p] && dist(d, p * 4, ref) <= threshold) {
      removed[p] = 1;
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
  while (stack.length) {
    const p = stack.pop()!;
    mask[p] = 0;
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < w * (h - 1)) seed(p + w);
  }

  // Pixels touching the removed area fade by how close they are to the background colour.
  for (let p = 0; p < w * h; p++) {
    if (removed[p]) continue;
    const x = p % w;
    const touches = (x > 0 && removed[p - 1]) || (x < w - 1 && removed[p + 1]) || (p >= w && removed[p - w]) || (p < w * (h - 1) && removed[p + w]);
    if (!touches) continue;
    const dd = dist(d, p * 4, ref);
    if (dd < soft) mask[p] = Math.round(255 * Math.min(1, Math.max(0.15, (dd - threshold) / (soft - threshold))));
  }

  // Edge softness: up to about 1 % of the image's longer side (at least a couple of pixels on small images).
  blurMask(mask, w, h, (s.softness / 100) * Math.max(2, 0.006 * Math.max(w, h)));
  return mask;
}
