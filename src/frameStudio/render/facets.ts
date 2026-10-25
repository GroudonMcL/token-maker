// Faceted shapes (DESIGN.md §5.5): an outline cut into flat faces that rise
// from its edge to a flat top (the "table"), or to a point. Each face's
// orientation is worked out in 3D and lit by the stage's light, so one light
// gives coherent highlights and shadows across gems, plates and crystals.

import { shade } from '../../render/color';
import type { Point } from '../../render/shapes';
import type { PathPoint } from '../project/types';
import type { Ctx } from './canvas';

/** How high the light is above the band for faces (as the bevel's default). */
const LIGHT_HEIGHT = (35 * Math.PI) / 180;

/**
 * Fills the polygon `pts` (in the current transform) as faces rising to a
 * table `table` times its size (0 = a point), `depth` steep, lit from
 * `light` (a unit vector towards the light, in the same frame).
 */
export function drawFacets(ctx: Ctx, pts: Point[], color: string, light: Point, table: number, depth: number): void {
  if (pts.length < 3) return;
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  const radius = pts.reduce((s, p) => s + Math.hypot(p.x - c.x, p.y - c.y), 0) / pts.length;
  const hgt = radius * depth * 0.5;
  const L = [light.x * Math.cos(LIGHT_HEIGHT), light.y * Math.cos(LIGHT_HEIGHT), Math.sin(LIGHT_HEIGHT)];
  const inner = pts.map((p) => ({ x: c.x + (p.x - c.x) * table, y: c.y + (p.y - c.y) * table }));
  // Clockwise or not, faces must face the viewer.
  const area = pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y, 0);
  const face = (poly: Point[], color: string) => {
    ctx.beginPath();
    poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // The same colour round the edge, so neighbouring faces leave no seam.
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const q = inner[i];
    // The face's normal: (b − a) × (q − a), with q raised.
    const u = [b.x - a.x, b.y - a.y, 0];
    const v = [q.x - a.x, q.y - a.y, hgt];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[2] < 0 || (n[2] === 0 && area < 0)) n = n.map((x) => -x);
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const lit = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len - L[2];
    const poly = table > 0.001 ? [a, b, inner[(i + 1) % pts.length], q] : [a, b, c];
    face(poly, shade(color, Math.max(-0.75, Math.min(0.75, lit * 1.25))));
  }
  if (table > 0.001) face(inner, shade(color, 0.06));
}

/** A path's outline as straight segments (curves sampled), in pixels for a transform's scale. */
export function flattenPath(points: PathPoint[], closed: boolean, ux: number, uy: number, samples = 8): Point[] {
  const out: Point[] = [];
  const n = points.length;
  if (n === 0) return out;
  const segments = closed ? n : n - 1;
  out.push({ x: points[0].x * ux, y: points[0].y * uy });
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    if (a.handle || b.handle) {
      const ax = a.x * ux, ay = a.y * uy;
      const bx = b.x * ux, by = b.y * uy;
      const c1x = ax + (a.handle?.x ?? 0) * ux, c1y = ay + (a.handle?.y ?? 0) * uy;
      const c2x = bx + (b.handleIn ? b.handleIn.x : -(b.handle?.x ?? 0)) * ux, c2y = by + (b.handleIn ? b.handleIn.y : -(b.handle?.y ?? 0)) * uy;
      for (let k = 1; k <= samples; k++) {
        const t = k / samples;
        const m = 1 - t;
        out.push({
          x: m * m * m * ax + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * bx,
          y: m * m * m * ay + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * by,
        });
      }
    } else out.push({ x: b.x * ux, y: b.y * uy });
  }
  if (closed && out.length > 1) out.pop();
  return out;
}
