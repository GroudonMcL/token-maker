// Small geometry helpers for the generators (DESIGN.md §5.7): tapered
// ribbons along a centre line, smooth noise along a line, polygon clipping
// and insetting, all in pixels.

import type { Point } from '../../render/shapes';
import type { Ctx } from './canvas';

/**
 * A ribbon round a centre line: `widths[i]` wide at `points[i]` (each side
 * half of it), with round ends. Traced as one closed outline, so a tapering
 * branch fills as a single shape.
 */
export function ribbon(points: Point[], widths: number[]): Point[] {
  const n = points.length;
  if (n < 2) return [];
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const h = Math.max(0, widths[i]) / 2;
    left.push({ x: points[i].x + nx * h, y: points[i].y + ny * h });
    right.push({ x: points[i].x - nx * h, y: points[i].y - ny * h });
  }
  // Round caps: half circles at each end.
  const cap = (p: Point, from: Point, h: number, k: number): Point[] => {
    const a0 = Math.atan2(from.y - p.y, from.x - p.x);
    return Array.from({ length: 6 }, (_v, j) => {
      const a = a0 + (k * Math.PI * (j + 1)) / 7;
      return { x: p.x + Math.cos(a) * h, y: p.y + Math.sin(a) * h };
    });
  };
  const end = cap(points[n - 1], left[n - 1], widths[n - 1] / 2, -1);
  const start = cap(points[0], right[0], widths[0] / 2, -1);
  return [...left, ...end, ...right.reverse(), ...start];
}

/** Traces a closed polygon. */
export function tracePoly(ctx: Ctx, pts: Point[]): void {
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/** A polygon's area, positive when its points run clockwise on screen. */
export function area(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** The middle of a polygon's points. */
export function centroid(pts: Point[]): Point {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}

/**
 * Cuts a convex polygon with a half-plane: keeps the points where
 * `nx·x + ny·y ≤ d` (Sutherland–Hodgman against one edge).
 */
export function clipHalfPlane(pts: Point[], nx: number, ny: number, d: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const da = nx * a.x + ny * a.y - d;
    const db = nx * b.x + ny * b.y - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/** A convex polygon shrunk by `by` on every side (empty if nothing is left). */
export function insetConvex(pts: Point[], by: number): Point[] {
  if (by <= 0 || pts.length < 3) return pts;
  const cw = area(pts) > 0 ? 1 : -1;
  let out = pts;
  for (let i = 0; i < pts.length && out.length >= 3; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    // Outward normal of edge a→b.
    const nx = (cw * (b.y - a.y)) / len;
    const ny = (cw * -(b.x - a.x)) / len;
    out = clipHalfPlane(out, nx, ny, nx * a.x + ny * a.y - by);
  }
  return out.length >= 3 ? out : [];
}

/** Rounds a polygon's corners by cutting each corner `r` along both sides and joining with a curve (as points). */
export function roundCorners(pts: Point[], r: number, steps = 4): Point[] {
  if (r <= 0 || pts.length < 3) return pts;
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[(i + pts.length - 1) % pts.length];
    const b = pts[(i + 1) % pts.length];
    const la = Math.hypot(a.x - p.x, a.y - p.y);
    const lb = Math.hypot(b.x - p.x, b.y - p.y);
    const k = Math.min(r, la / 2.2, lb / 2.2);
    const s = { x: p.x + ((a.x - p.x) / (la || 1)) * k, y: p.y + ((a.y - p.y) / (la || 1)) * k };
    const e = { x: p.x + ((b.x - p.x) / (lb || 1)) * k, y: p.y + ((b.y - p.y) / (lb || 1)) * k };
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const m = 1 - t;
      // A quadratic curve with the corner as its control point.
      out.push({ x: m * m * s.x + 2 * m * t * p.x + t * t * e.x, y: m * m * s.y + 2 * m * t * p.y + t * t * e.y });
    }
  }
  return out;
}

/** Repeatable 1D noise in −1…1 (smooth, from seeded values at whole numbers). */
export function noise1(x: number, seed: number): number {
  const h = (i: number) => {
    let v = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x9e3779b1);
    v = Math.imul(v ^ (v >>> 15), 0x85ebca6b);
    v = Math.imul(v ^ (v >>> 13), 0xc2b2ae35);
    return (((v ^ (v >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}
