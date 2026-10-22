// @vitest-environment node
// Finding the hole in picture frames (DESIGN.md §6.9), on sample frames
// drawn as plain pixels, plus the built-in frames from public/frames/.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { FRAME_LIBRARY } from '../render/imageFrames';
import type { PixelBuffer } from './adjust';
import { circleHole, findFrameHole, nudgedHole } from './frameHole';

/** A w×h picture, solid wherever `solid(u, v)` says so (u, v run -1…1 across the longer side, like token units). */
function frame(w: number, h: number, solid: (u: number, v: number) => boolean): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  const side = Math.max(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (side / 2);
      const v = (y + 0.5 - h / 2) / (side / 2);
      if (solid(u, v)) data.set([200, 160, 60, 255], (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h };
}

const ring = (inner: number, outer: number, cx = 0, cy = 0) => (u: number, v: number) => {
  const r = Math.hypot(u - cx, v - cy);
  return r >= inner && r <= outer;
};

const points = (hole: number[]) => Array.from({ length: hole.length / 2 }, (_, i) => ({ x: hole[i * 2]!, y: hole[i * 2 + 1]! }));
const radii = (hole: number[], cx = 0, cy = 0) => points(hole).map((p) => Math.hypot(p.x - cx, p.y - cy));

describe('finding a picture frame’s hole', () => {
  it('finds the round hole of a ring, a little bigger so the art runs under the edge', () => {
    const h = findFrameHole(frame(256, 256, ring(0.7, 0.95)));
    expect(h.found).toBe(true);
    expect(h.open).toBe(false);
    for (const r of radii(h.hole)) {
      expect(r).toBeGreaterThan(0.7);
      expect(r).toBeLessThan(0.74);
    }
    expect(h.outer).toBeCloseTo(0.95, 1);
  });

  it('follows a square hole and an off-centre hole', () => {
    const square = findFrameHole(frame(200, 200, (u, v) => Math.max(Math.abs(u), Math.abs(v)) > 0.6 && Math.max(Math.abs(u), Math.abs(v)) < 0.9));
    const corner = points(square.hole).reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0);
    expect(corner).toBeGreaterThan(0.6 * Math.SQRT2 * 0.97); // reaches into the square's corners
    const off = findFrameHole(frame(240, 240, ring(0.5, 0.75, 0.15, -0.1)));
    for (const r of radii(off.hole, 0.15, -0.1)) expect(Math.abs(r - 0.51)).toBeLessThan(0.03);
  });

  it('works on pictures that are not square (fitted into the token’s square)', () => {
    // 300×200: the ring fills the height; token units run across the longer side.
    const wide = findFrameHole(frame(300, 200, ring(0.45, 0.62)));
    for (const r of radii(wide.hole)) expect(Math.abs(r - 0.46)).toBeLessThan(0.03);
  });

  it('starts from the nearest see-through spot when a gem covers the very middle', () => {
    const h = findFrameHole(frame(200, 200, (u, v) => ring(0.6, 0.9)(u, v) || Math.hypot(u, v) < 0.06));
    expect(h.found).toBe(true);
    // The rays start beside the gem, so most of the hole is still the ring's.
    const big = radii(h.hole).filter((r) => r > 0.55).length;
    expect(big / radii(h.hole).length).toBeGreaterThan(0.6);
  });

  it('ignores a thin spike into the hole', () => {
    const spiky = (u: number, v: number) => ring(0.6, 0.9)(u, v) || (Math.abs(v) < 0.01 && u > 0.3 && u < 0.6);
    const h = findFrameHole(frame(300, 300, spiky));
    for (const r of radii(h.hole)) expect(r).toBeGreaterThan(0.55);
  });

  it('says when the frame is not closed all round, or has no hole at all', () => {
    const gap = findFrameHole(frame(200, 200, (u, v) => ring(0.6, 0.9)(u, v) && !(v > 0 && Math.abs(u) < 0.1)));
    expect(gap.found).toBe(true);
    expect(gap.open).toBe(true);
    const solid = findFrameHole(frame(100, 100, (u, v) => Math.hypot(u, v) < 0.95));
    expect(solid.found).toBe(false);
    expect(solid.hole).toEqual(circleHole());
  });

  it('nudging moves and scales the hole around its own middle', () => {
    const hole = [0.5, 0, 0, 0.5, -0.5, 0, 0, -0.5];
    expect(nudgedHole(hole, { x: 0, y: 0, scale: 1 })).toEqual(points(hole));
    const moved = nudgedHole(hole, { x: 0.1, y: -0.2, scale: 2 });
    expect(moved[0]).toEqual({ x: 1.1, y: -0.2 });
    expect(moved[1]).toEqual({ x: 0.1, y: 0.8 });
  });

  it.each(FRAME_LIBRARY.map((f) => [f.name, f.id] as const))('finds a closed, round-ish hole in the built-in %s frame', async (_name, id) => {
    const img = await loadImage(readFileSync(`public/frames/${id}.webp`));
    const c = createCanvas(256, 256);
    c.getContext('2d').drawImage(img, 0, 0, 256, 256);
    const h = findFrameHole(c.getContext('2d').getImageData(0, 0, 256, 256));
    expect(h.found).toBe(true);
    expect(h.open).toBe(false);
    for (const r of radii(h.hole)) {
      expect(r).toBeGreaterThan(0.6);
      expect(r).toBeLessThan(0.85);
    }
  });
});
