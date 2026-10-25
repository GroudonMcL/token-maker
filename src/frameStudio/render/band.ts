// The frame band a design is drawn on, and positions measured against it
// (DESIGN.md §4.2). The engine's FrameGeometry is reused as is, so a legacy
// frame and the editable layers line up exactly.

import type { FrameGeometry } from '../../render/frameKit';
import { ornamentCount, perimeterLength } from '../../render/frameKit';
import { shapePolygon, type PerimeterSample, type Point } from '../../render/shapes';
import type { StageSettings } from '../project/types';

/** Largest total inset, as in token-maker, so the opening never disappears. */
const MAX_INSET = 0.85;

/** Band edges as fractions of the half-size, scaled down together if they would swallow the token. */
export function bandInsets(stage: Pick<StageSettings, 'thickness' | 'outerSpacing'>): { outer: number; inner: number } {
  let t = stage.thickness;
  let m = stage.outerSpacing;
  if (t + m > MAX_INSET) {
    const k = MAX_INSET / (t + m);
    t *= k;
    m *= k;
  }
  return { outer: m, inner: m + t };
}

/** The band for a `size` px render, in pixels, with the origin at the token's centre. */
export function bandGeometry(stage: StageSettings, size: number, color = '#ffffff', accent?: string): FrameGeometry {
  const R = size / 2;
  const { outer, inner } = bandInsets(stage);
  return { shape: stage.shape, R, outer: outer * R, inner: inner * R, color, accent };
}

export const bandWidthPx = (g: FrameGeometry) => g.inner - g.outer;

/** Pixels in from the token's edge for an "across" position (0 outer edge, 1 inner edge). */
export const insetAt = (g: FrameGeometry, across: number) => g.outer + (g.inner - g.outer) * across;

/** The outline at an "across" position (empty if it falls outside the token or past its middle). */
export function outlineAt(g: FrameGeometry, across: number): Point[] {
  return shapePolygon(g.shape, g.R, insetAt(g, across));
}

/**
 * `count` points evenly spaced along a closed outline, starting `offset` of
 * one gap after its first vertex (the top). Each carries the direction of
 * travel, like the engine's samplePerimeter.
 */
export function spacedAlong(points: Point[], count: number, offset = 0): PerimeterSample[] {
  if (points.length < 2 || count <= 0) return [];
  const edges = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return { p, q, length: Math.hypot(q.x - p.x, q.y - p.y) };
  });
  const total = perimeterLength(points);
  const out: PerimeterSample[] = [];
  for (let i = 0; i < count; i++) {
    let target = (((i + offset) / count) % 1) * total;
    let e = 0;
    while (e < edges.length - 1 && target > edges[e].length) {
      target -= edges[e].length;
      e++;
    }
    const { p, q, length } = edges[e];
    const t = length === 0 ? 0 : Math.min(1, target / length);
    out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, angle: Math.atan2(q.y - p.y, q.x - p.x) });
  }
  return out;
}

/** How many elements a repeat gets: an exact count, or as many as fit at a spacing (in band widths). */
export function repeatCount(g: FrameGeometry, across: number, mode: 'count' | 'spacing', count: number, spacing: number, snap: boolean, multipleOf = 1): number {
  const outline = outlineAt(g, across);
  if (outline.length === 0) return 0;
  const m = Math.max(1, Math.round(multipleOf));
  const n =
    mode === 'count'
      ? Math.max(m, Math.round(count / m) * m)
      : Math.max(m, Math.round(perimeterLength(outline) / Math.max(1, spacing * bandWidthPx(g) * m)) * m);
  return snap ? ornamentCount(g.shape, n) : n;
}

/**
 * How far a point is in from the token's edge, in pixels: the distance to the
 * nearest side of the outer outline. Every token shape is convex, and the
 * inset outlines are parallel offsets, so this inverts `insetAt`.
 */
export function insetOfPoint(g: FrameGeometry, pt: Point): number {
  const poly = shapePolygon(g.shape, g.R, 0);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Signed distance to the side's line, positive inside (outlines run clockwise on screen).
    const d = ((b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)) / len;
    best = Math.min(best, d);
  }
  return best;
}

/** The "across" position of a point (0 outer edge, 1 inner edge). */
export const acrossOfPoint = (g: FrameGeometry, pt: Point) => (insetOfPoint(g, pt) - g.outer) / Math.max(1e-9, g.inner - g.outer);

/** How far round an outline (0–1, clockwise from its first vertex) the point on it nearest `pt` is. */
export function alongOfPoint(points: Point[], pt: Point): number {
  if (points.length < 2) return 0;
  const total = perimeterLength(points);
  let walked = 0;
  let best = { d: Infinity, along: 0 };
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
    const d = Math.hypot(a.x + dx * t - pt.x, a.y + dy * t - pt.y);
    if (d < best.d) best = { d, along: (walked + Math.sqrt(len2) * t) / total };
    walked += Math.sqrt(len2);
  }
  return best.along % 1;
}

/** The largest "across" position whose outline still exists, with a little room to spare. */
export const maxAcross = (g: FrameGeometry) => Math.min(1.5, (g.R * 0.95 - g.outer) / Math.max(1e-9, g.inner - g.outer));
