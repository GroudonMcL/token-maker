// The erase/restore brush (DESIGN.md §6.2). Strokes are stored as points in
// the art image's own coordinates and painted onto the removal mask here.
// Within one stroke the brush doesn't build up: going over the same spot
// twice in one stroke has the same effect as once, so a soft edge stays soft.

import type { BrushStroke } from '../document/types';

/** A pixel rectangle, x1 and y1 exclusive. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const unionRect = (a: Rect | null, b: Rect | null): Rect | null =>
  !a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };

/** Pen pressure makes the brush smaller, down to a quarter of its size; mouse and touch count as full pressure. */
export const pressureScale = (p: number) => 0.25 + 0.75 * Math.min(1, Math.max(0, p));

/**
 * Adds the dabs of a stroke from point `from` onwards to `cov` (0–255
 * coverage of this stroke). Starting part-way through continues the line
 * from the previous point, so a stroke can be painted as it is drawn.
 */
export function paintCoverage(cov: Uint8Array, w: number, h: number, stroke: BrushStroke, from = 0): Rect | null {
  const L = Math.max(w, h);
  const pts = stroke.points;
  const n = Math.floor(pts.length / 3);
  let rect: Rect | null = null;
  const at = (i: number) => ({ x: pts[i * 3]! * L, y: pts[i * 3 + 1]! * L, r: Math.max(0.5, stroke.radius * L * pressureScale(pts[i * 3 + 2]!)) });
  for (let i = Math.max(0, from); i < n; i++) {
    const b = at(i);
    if (i === 0) {
      rect = unionRect(rect, dab(cov, w, h, b.x, b.y, b.r, stroke.softness));
      continue;
    }
    const a = at(i - 1);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const spacing = Math.max(0.5, Math.min(a.r, b.r) * 0.15);
    const steps = Math.max(1, Math.ceil(len / spacing));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      rect = unionRect(rect, dab(cov, w, h, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.r + (b.r - a.r) * t, stroke.softness));
    }
  }
  return rect;
}

/** One round dab: full strength inside, fading smoothly to nothing at its edge. */
function dab(cov: Uint8Array, w: number, h: number, cx: number, cy: number, r: number, softness: number): Rect | null {
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(w, Math.ceil(cx + r) + 1);
  const y1 = Math.min(h, Math.ceil(cy + r) + 1);
  if (x0 >= x1 || y0 >= y1) return null;
  const inner = r * (1 - Math.min(0.95, softness));
  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= r) continue;
      let a = 255;
      if (d > inner) {
        const t = 1 - (d - inner) / (r - inner);
        a = 255 * t * t * (3 - 2 * t);
      }
      const i = y * w + x;
      if (a > cov[i]!) cov[i] = a;
    }
  }
  return { x0, y0, x1, y1 };
}

/** Applies a stroke's coverage to the mask inside `rect`: erase removes, restore brings back (relative to the mask before the stroke). */
export function applyCoverage(mask: Uint8Array, before: Uint8Array, cov: Uint8Array, w: number, mode: BrushStroke['mode'], rect: Rect): void {
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let i = y * w + rect.x0, end = y * w + rect.x1; i < end; i++) {
      const c = cov[i]! / 255;
      const m = before[i]!;
      mask[i] = Math.round(mode === 'erase' ? m * (1 - c) : m + (255 - m) * c);
    }
  }
}

/** Paints every stroke onto `mask`, in order. Returns the area that changed. */
export function applyStrokes(mask: Uint8Array, w: number, h: number, strokes: readonly BrushStroke[]): Rect | null {
  let changed: Rect | null = null;
  const cov = new Uint8Array(w * h);
  for (const stroke of strokes) {
    cov.fill(0);
    const rect = paintCoverage(cov, w, h, stroke);
    if (!rect) continue;
    applyCoverage(mask, mask, cov, w, stroke.mode, rect); // coverage is final, so in place is safe
    changed = unionRect(changed, rect);
  }
  return changed;
}
