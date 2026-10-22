import { createDocument, DEFAULT_TRANSFORM } from '../document/defaults';
import type { ArtTransform } from '../document/types';
import {
  artCorners,
  imagePointAt,
  clampTransform,
  fillTransform,
  fitTransform,
  imageClipPolygon,
  initialTransform,
  minZoomToCover,
  normaliseAngle,
  rotateAround,
  zoomAround,
} from './geometry';
import { pointInPolygon } from './shapes';

const clip = imageClipPolygon(createDocument());
const LOCKED: ArtTransform = { ...DEFAULT_TRANSFORM, lockFill: true };

/** True when every clip vertex is inside the art rectangle. */
function covers(t: ArtTransform, w: number, h: number) {
  const corners = artCorners(t, w, h, clip);
  return clip.every((p) => pointInPolygon({ x: p.x * 0.999, y: p.y * 0.999 }, corners));
}

describe('crop geometry', () => {
  it('locked art always covers the frame after moving, zooming out and rotating', () => {
    for (const rotation of [0, 17, 45, 90, 133]) {
      const t = clampTransform({ ...LOCKED, rotation, zoom: 0.2, offsetX: 3, offsetY: -2 }, 400, 300, clip);
      expect(covers(t, 400, 300)).toBe(true);
      expect(t.zoom).toBeCloseTo(minZoomToCover(400, 300, clip, rotation), 6);
    }
  });

  it('free art may move but stays near the token', () => {
    const t = clampTransform({ ...DEFAULT_TRANSFORM, lockFill: false, offsetX: 50 }, 400, 400, clip);
    expect(t.offsetX).toBe(3);
  });

  it('zooms around the pointer, keeping that point still', () => {
    const t = zoomAround({ ...DEFAULT_TRANSFORM, offsetX: 0.2 }, 2, { x: 0.5, y: 0 });
    // The point under the pointer was 0.3 from the art centre; now it is 0.6 away, at the same place.
    expect(0.5 - t.offsetX).toBeCloseTo(0.6, 6);
  });

  it('rotates around a point', () => {
    const t = rotateAround({ ...DEFAULT_TRANSFORM, offsetX: 1 }, 90, { x: 0, y: 0 });
    expect(t.rotation).toBe(90);
    expect(t.offsetX).toBeCloseTo(0, 6);
    expect(t.offsetY).toBeCloseTo(1, 6);
    expect(normaliseAngle(270)).toBe(-90);
  });

  it('fill covers, fit shows the whole art', () => {
    const fill = fillTransform({ ...DEFAULT_TRANSFORM, rotation: 30 }, 300, 600, clip);
    expect(covers(fill, 300, 600)).toBe(true);
    const fit = fitTransform(fill, 300, 600, clip);
    expect(fit.rotation).toBe(0);
    expect(fit.lockFill).toBe(false);
    const corners = artCorners(fit, 300, 600, clip);
    expect(Math.max(...corners.map((p) => Math.abs(p.y)))).toBeLessThanOrEqual(1);
  });

  it('starts tall portraits higher up, where faces usually are', () => {
    expect(initialTransform(300, 800, clip).offsetY).toBeGreaterThan(0);
    expect(initialTransform(800, 800, clip).offsetY).toBe(0);
  });

  it('finds the picture point under a canvas point, whatever the transform', () => {
    const clip = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
    const t = { ...DEFAULT_TRANSFORM, zoom: 2, offsetX: 0.3, offsetY: -0.2, rotation: 90, flipX: true };
    // Every corner of the drawn picture maps back to that corner of the picture.
    const corners = artCorners(t, 400, 200, clip);
    const back = corners.map((c) => imagePointAt(t, 400, 200, clip, c));
    // artCorners ignores flips, so with flipX the left/right corners swap.
    expect(back[0]!.x).toBeCloseTo(1);
    expect(back[0]!.y).toBeCloseTo(0);
    expect(back[2]!.x).toBeCloseTo(0);
    expect(back[2]!.y).toBeCloseTo(1);
    expect(imagePointAt(t, 400, 200, clip, { x: 0.3, y: -0.2 })).toEqual({ x: 0.5, y: 0.5 });
  });
});
