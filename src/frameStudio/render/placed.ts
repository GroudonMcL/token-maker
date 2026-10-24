// Shapes and paths: where they sit (anchored on the band or placed freely),
// their mirrored copies, and drawing them. The same transforms are used to
// draw, to pick on the canvas and to place the editing handles, so they
// always agree.

import { rgba } from '../../render/color';
import { noShadow, type FrameGeometry } from '../../render/frameKit';
import type { Point } from '../../render/shapes';
import type { PathPoint, PlacedLayer, ShapeLayer } from '../project/types';
import { bandWidthPx, outlineAt, spacedAlong } from './band';
import type { Ctx } from './canvas';
import { shadedFill } from './elements';
import { lightVector, raisedFrom, turn } from './light';

/**
 * Local units → canvas pixels: scale (x by `ux`, y by `uy`), flip (`sx`, `sy`),
 * turn by `angle` radians, then move to (`x`, `y`). Local y points inwards on
 * the band (down when placed freely); 1 unit is half the layer's height.
 */
export interface Placed {
  x: number;
  y: number;
  angle: number;
  ux: number;
  uy: number;
  sx: 1 | -1;
  sy: 1 | -1;
}

/** Pixels per local unit vertically (half the height). */
export function unitPx(layer: PlacedLayer, g: FrameGeometry): number {
  return (layer.size * (layer.place === 'band' ? bandWidthPx(g) : g.R)) / 2;
}

/** The layer's own transform (without mirrored copies), or null if its band position falls outside the token. */
export function placement(layer: PlacedLayer, g: FrameGeometry): Placed | null {
  const rot = (layer.rotation * Math.PI) / 180;
  const uy = unitPx(layer, g);
  const ux = uy * layer.stretch;
  if (layer.place === 'free') return { x: layer.x * g.R, y: layer.y * g.R, angle: rot, ux, uy, sx: 1, sy: 1 };
  const [p] = spacedAlong(outlineAt(g, layer.across), 1, layer.along);
  if (!p) return null;
  return { x: p.x, y: p.y, angle: p.angle + rot, ux, uy, sx: 1, sy: 1 };
}

/**
 * The layer and its mirrored copies. Every token shape is symmetric about
 * both axes, so a mirrored copy lands at the matching place on the band.
 * Mirroring the plane flips the shape and turns it the other way.
 */
export function placements(layer: PlacedLayer, g: FrameGeometry): Placed[] {
  const t = placement(layer, g);
  if (!t) return [];
  const leftRight: Placed = { ...t, x: -t.x, angle: -t.angle, sx: -1 };
  const topBottom: Placed = { ...t, y: -t.y, angle: -t.angle, sy: -1 };
  const both: Placed = { ...t, x: -t.x, y: -t.y, angle: t.angle + Math.PI };
  switch (layer.mirror) {
    case 'leftRight':
      return [t, leftRight];
    case 'topBottom':
      return [t, topBottom];
    case 'four':
      return [t, leftRight, topBottom, both];
    default:
      return [t];
  }
}

/** A local point in canvas pixels. */
export function toCanvas(t: Placed, p: Point): Point {
  const v = turn({ x: p.x * t.ux * t.sx, y: p.y * t.uy * t.sy }, t.angle);
  return { x: t.x + v.x, y: t.y + v.y };
}

/** A canvas point in local units. */
export function toLocal(t: Placed, p: Point): Point {
  const v = turn({ x: p.x - t.x, y: p.y - t.y }, -t.angle);
  return { x: (v.x * t.sx) / (t.ux || 1), y: (v.y * t.sy) / (t.uy || 1) };
}

/** The local box a layer occupies (for picking and the selection box). */
export function localBounds(layer: PlacedLayer): { minX: number; maxX: number; minY: number; maxY: number } {
  if (layer.type === 'shape' || layer.points.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const xs = layer.points.map((p) => p.x);
  const ys = layer.points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function traceShape(ctx: Ctx, layer: ShapeLayer, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2;
  ctx.beginPath();
  switch (layer.shape) {
    case 'circle':
      ctx.ellipse(0, 0, x, y, 0, 0, Math.PI * 2);
      break;
    case 'rectangle': {
      const r = layer.corner * Math.min(x, y);
      ctx.moveTo(-x + r, -y);
      ctx.arcTo(x, -y, x, y, r);
      ctx.arcTo(x, y, -x, y, r);
      ctx.arcTo(-x, y, -x, -y, r);
      ctx.arcTo(-x, -y, x, -y, r);
      break;
    }
    case 'polygon':
    case 'star': {
      const n = layer.shape === 'star' ? layer.sides * 2 : layer.sides;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
        const r = layer.shape === 'star' && i % 2 ? layer.innerRatio : 1;
        ctx.lineTo(Math.cos(a) * x * r, Math.sin(a) * y * r);
      }
      break;
    }
  }
  ctx.closePath();
}

/** The path's points in pixels for a transform's scale (before turning and moving). */
function scaled(points: PathPoint[], ux: number, uy: number) {
  return points.map((p) => ({ x: p.x * ux, y: p.y * uy, hx: (p.handle?.x ?? 0) * ux, hy: (p.handle?.y ?? 0) * uy, curved: !!p.handle }));
}

/** Traces a path in pixels around its anchor. Curves use each point's handle (leaving) and its mirror (arriving). */
export function tracePath(ctx: Ctx, points: PathPoint[], closed: boolean, ux: number, uy: number): void {
  const pts = scaled(points, ux, uy);
  ctx.beginPath();
  if (pts.length === 0) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  const segments = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a.curved || b.curved) ctx.bezierCurveTo(a.x + a.hx, a.y + a.hy, b.x - b.hx, b.y - b.hy, b.x, b.y);
    else ctx.lineTo(b.x, b.y);
  }
  if (closed) ctx.closePath();
}

/** Draws a shape or path layer, with its mirrored copies, lit from `light`. */
export function drawPlaced(ctx: Ctx, layer: PlacedLayer, g: FrameGeometry, light: number): void {
  const all = placements(layer, g);
  if (all.length === 0) return;
  const h = all[0].uy * 2;
  const w = all[0].ux * 2;
  const canFill = layer.fill !== null && (layer.type === 'shape' || (layer.closed && layer.points.length > 2));
  ctx.save();
  if (layer.raised) raisedFrom(ctx, layer.place === 'band' ? bandWidthPx(g) : g.R * 0.14, light);
  if (layer.glow) {
    ctx.shadowColor = rgba(layer.glow, 1);
    ctx.shadowBlur = h * 0.35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  for (const t of all) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    ctx.scale(t.sx, t.sy);
    if (layer.type === 'shape') traceShape(ctx, layer, w, h);
    else tracePath(ctx, layer.points, layer.closed, t.ux, t.uy);
    if (canFill) {
      if (layer.shaded) {
        // The light as seen from inside this copy (turned and flipped with it).
        const v = turn(lightVector(light), -t.angle);
        const box = layer.type === 'path' ? localBounds(layer) : { minX: -1, maxX: 1, minY: -1, maxY: 1 };
        const bw = Math.max(1, (box.maxX - box.minX) * t.ux);
        const bh = Math.max(1, (box.maxY - box.minY) * t.uy);
        ctx.save();
        ctx.translate(((box.minX + box.maxX) / 2) * t.ux, ((box.minY + box.maxY) / 2) * t.uy);
        shadedFill(ctx, layer.fill!, bw, bh, { x: v.x * t.sx, y: v.y * t.sy });
        ctx.restore();
      } else {
        ctx.fillStyle = layer.fill!;
        ctx.fill();
      }
    }
    if (layer.outline && layer.outlineWidth > 0) {
      // Only the fill casts the shadow when there is one, so outlines don't double it.
      if (canFill) noShadow(ctx);
      ctx.strokeStyle = layer.outline;
      ctx.lineWidth = Math.max(0.5, h * layer.outlineWidth);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
