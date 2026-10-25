// Shapes and paths: where they sit (anchored on the band or placed freely),
// their mirrored copies, and drawing them. The same transforms are used to
// draw, to pick on the canvas and to place the editing handles, so they
// always agree.

import { rgba } from '../../render/color';
import { noShadow, type FrameGeometry } from '../../render/frameKit';
import type { Point } from '../../render/shapes';
import type { PathLayer, PathPoint, PlacedLayer, ShapeLayer } from '../project/types';
import { ribbon, tracePoly } from './geometry';
import { bandWidthPx, outlineAt, spacedAlong } from './band';
import type { Ctx } from './canvas';
import { drawElement, paintPattern, shadedFill } from './elements';
import { drawFacets, flattenPath } from './facets';
import { paintCanvas } from './paint';
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
 * Mirroring the plane flips the shape and turns it the other way. A radial
 * array (version 6) then puts `radialCount` copies of each round its anchor,
 * each pointing outwards, the first at `radialStart` degrees from "up".
 */
export function placements(layer: PlacedLayer, g: FrameGeometry): Placed[] {
  const t = placement(layer, g);
  if (!t) return [];
  const leftRight: Placed = { ...t, x: -t.x, angle: -t.angle, sx: -1 };
  const topBottom: Placed = { ...t, y: -t.y, angle: -t.angle, sy: -1 };
  const both: Placed = { ...t, x: -t.x, y: -t.y, angle: t.angle + Math.PI };
  const mirrored = layer.mirror === 'leftRight' ? [t, leftRight] : layer.mirror === 'topBottom' ? [t, topBottom] : layer.mirror === 'four' ? [t, leftRight, topBottom, both] : [t];
  if (!(layer.radialCount > 1)) return mirrored;
  const r = layer.radialRadius * (layer.place === 'band' ? bandWidthPx(g) : g.R);
  return mirrored.flatMap((m) => radialCopies(m, layer.radialCount, r, layer.radialStart, layer.radialMirror));
}

/** `n` copies of a transform round its own origin, `r` pixels out, pointing outwards. */
export function radialCopies(m: Placed, n: number, r: number, startDeg: number, mirrorEvery: boolean): Placed[] {
  return Array.from({ length: n }, (_v, k) => {
    const a = ((startDeg + (k * 360) / n) * Math.PI) / 180;
    // Out from the anchor along the copy's "up" (local −y), in the flipped and turned frame of `m`.
    const v = turn({ x: Math.sin(a) * r * m.sx, y: -Math.cos(a) * r * m.sy }, m.angle);
    const flip = mirrorEvery && k % 2 === 1 ? -1 : 1;
    return { ...m, x: m.x + v.x, y: m.y + v.y, angle: m.angle + m.sx * m.sy * a, sx: (m.sx * flip) as 1 | -1 };
  });
}

/** The copy shown with handles and points: the layer itself, or the first of its radial array. */
export function primaryPlacement(layer: PlacedLayer, g: FrameGeometry): Placed | null {
  return placements(layer, g)[0] ?? null;
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
    case 'ornament':
      break;
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

/** A shape's outline as points, for faceting (curves sampled). */
function shapePoints(layer: ShapeLayer, w: number, h: number): Point[] {
  const x = w / 2;
  const y = h / 2;
  switch (layer.shape) {
    // An ornament's outline isn't a polygon; its oval box stands in for it.
    case 'ornament':
    case 'circle':
      return Array.from({ length: 16 }, (_v, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 16;
        return { x: Math.cos(a) * x, y: Math.sin(a) * y };
      });
    case 'rectangle': {
      const r = layer.corner * Math.min(x, y);
      if (r < 0.5) return [{ x: -x, y: -y }, { x, y: -y }, { x, y }, { x: -x, y }];
      const out: Point[] = [];
      const corners = [[x - r, -y + r, -Math.PI / 2], [x - r, y - r, 0], [-x + r, y - r, Math.PI / 2], [-x + r, -y + r, Math.PI]];
      for (const [cx, cy, a0] of corners) for (let k = 0; k <= 3; k++) out.push({ x: cx + Math.cos(a0 + (k * Math.PI) / 6) * r, y: cy + Math.sin(a0 + (k * Math.PI) / 6) * r });
      return out;
    }
    case 'polygon':
    case 'star': {
      const n = layer.shape === 'star' ? layer.sides * 2 : layer.sides;
      return Array.from({ length: n }, (_v, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
        const k = layer.shape === 'star' && i % 2 ? layer.innerRatio : 1;
        return { x: Math.cos(a) * x * k, y: Math.sin(a) * y * k };
      });
    }
  }
}

/** The path's points in pixels for a transform's scale (before turning and moving). */
function scaled(points: PathPoint[], ux: number, uy: number) {
  return points.map((p) => ({
    x: p.x * ux,
    y: p.y * uy,
    hx: (p.handle?.x ?? 0) * ux,
    hy: (p.handle?.y ?? 0) * uy,
    // The arriving control point: its own, or the mirror of the leaving one.
    ix: (p.handleIn ? p.handleIn.x : -(p.handle?.x ?? 0)) * ux,
    iy: (p.handleIn ? p.handleIn.y : -(p.handle?.y ?? 0)) * uy,
    curved: !!p.handle,
  }));
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
    if (a.curved || b.curved) ctx.bezierCurveTo(a.x + a.hx, a.y + a.hy, b.x + b.ix, b.y + b.iy, b.x, b.y);
    else ctx.lineTo(b.x, b.y);
  }
  if (closed) ctx.closePath();
}

/** Draws a shape or path layer, with its mirrored copies, lit from `light`. */
export function drawPlaced(ctx: Ctx, layer: PlacedLayer, g: FrameGeometry, light: number, size = g.R * 2): void {
  const all = placements(layer, g);
  if (all.length === 0) return;
  const h = all[0].uy * 2;
  const w = all[0].ux * 2;
  if (layer.type === 'path' && layer.stroke > 0) return drawStroke(ctx, layer, all, light, g);
  const canFill = layer.fill !== null && (layer.type === 'shape' || (layer.closed && layer.points.length > 2));
  const paint = layer.fill !== null && layer.fillPaint ? { canvas: paintCanvas(layer.fillPaint, g, light, size), each: layer.paintEach } : null;
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
    if (layer.type === 'shape' && layer.shape === 'ornament') {
      // One of the repeat shapes, drawn by the same code (it draws its own outline).
      const v = turn(lightVector(light), -t.angle);
      drawElement(ctx, layer.element, h, layer.stretch, {
        fill: layer.fill ?? 'rgba(0, 0, 0, 0)',
        outline: layer.outline,
        outlineWidth: layer.outlineWidth,
        rune: 0,
        light: { x: v.x * t.sx, y: v.y * t.sy },
        shaded: layer.shaded,
        detail: layer.detail,
        paint,
      });
      ctx.restore();
      continue;
    }
    if (layer.type === 'shape') traceShape(ctx, layer, w, h);
    else tracePath(ctx, layer.points, layer.closed, t.ux, t.uy);
    if (canFill) {
      if (layer.faceted) {
        // The whole outline first (it casts the shadow and glow), then the faces over it.
        ctx.fillStyle = layer.fill!;
        ctx.fill();
        ctx.save();
        noShadow(ctx);
        const v = turn(lightVector(light), -t.angle);
        const pts = layer.type === 'shape' ? shapePoints(layer, w, h) : flattenPath(layer.points, true, t.ux, t.uy);
        drawFacets(ctx, pts, layer.fill!, { x: v.x * t.sx, y: v.y * t.sy }, layer.facetTable, layer.facetDepth);
        ctx.restore();
        // Back to the outline, for the stroke.
        if (layer.type === 'shape') traceShape(ctx, layer, w, h);
        else tracePath(ctx, layer.points, layer.closed, t.ux, t.uy);
      } else if (layer.shaded || paint) {
        // The light as seen from inside this copy (turned and flipped with it).
        const v = turn(lightVector(light), -t.angle);
        const box = layer.type === 'path' ? localBounds(layer) : { minX: -1, maxX: 1, minY: -1, maxY: 1 };
        const bw = Math.max(1, (box.maxX - box.minX) * t.ux);
        const bh = Math.max(1, (box.maxY - box.minY) * t.uy);
        ctx.save();
        ctx.translate(((box.minX + box.maxX) / 2) * t.ux, ((box.minY + box.maxY) / 2) * t.uy);
        const fill = paint ? paintPattern(ctx, paint, ctx.getTransform(), bw, bh) : layer.fill!;
        shadedFill(ctx, fill, bw, bh, { x: v.x * t.sx, y: v.y * t.sy }, 'nonzero', layer.shaded);
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

/**
 * A path drawn as a filled stroke (version 8): a ribbon round its line,
 * `stroke` times its height wide, narrowing towards its ends, in its fill
 * colour (or its outline colour if it has no fill), so effects see a shape.
 */
function drawStroke(ctx: Ctx, layer: PathLayer, all: Placed[], light: number, g: FrameGeometry): void {
  const color = layer.fill ?? layer.outline ?? '#000000';
  ctx.save();
  if (layer.raised) raisedFrom(ctx, layer.place === 'band' ? bandWidthPx(g) : g.R * 0.14, light);
  for (const t of all) {
    const pts = flattenPath(layer.points, layer.closed, t.ux, t.uy, 12);
    if (pts.length < 2) continue;
    if (layer.closed) pts.push(pts[0]);
    // Lengths along it, for the taper.
    const at = [0];
    for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const L = at[at.length - 1] || 1;
    const w = layer.stroke * t.uy * 2;
    const widths = at.map((d) => {
      const k = d / L;
      return Math.max(0.3, w * Math.min(1, layer.taperStart > 0 ? k / (layer.taperStart * 0.5) : 1, layer.taperEnd > 0 ? (1 - k) / (layer.taperEnd * 0.5) : 1) ** 0.8);
    });
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    ctx.scale(t.sx, t.sy);
    ctx.beginPath();
    tracePoly(ctx, ribbon(pts, widths));
    if (layer.shaded) {
      const v = turn(lightVector(light), -t.angle);
      const box = localBounds(layer);
      shadedFill(ctx, color, Math.max(1, (box.maxX - box.minX) * t.ux), Math.max(1, (box.maxY - box.minY) * t.uy), { x: v.x * t.sx, y: v.y * t.sy });
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** A shape layer's outline as path points (for "Turn into a path"), in the path's own units. */
export function shapeAsPath(layer: ShapeLayer): PathPoint[] {
  // One unit is half the height across and (with the layer's stretch, which the path keeps) half the width along.
  return shapePoints(layer, 2, 2).map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, handle: null }));
}
