// Canvas actions for the Image section's tools (DESIGN.md §6.2): brush
// strokes and the background eyedropper. Points arrive in R units from the
// token centre and are stored in the art image's own coordinates.

import type { BrushStroke } from '../document/types';
import { sampleOriginal } from '../image/processArt';
import { imageClipPolygon, imagePixelsPerUnit, toImagePoint } from '../render/geometry';
import type { Point } from '../render/shapes';
import { getAssets } from '../state/assets';
import { getDoc, updateDoc } from '../state/tokenStore';

const round = (v: number) => Math.round(v * 1e5) / 1e5;

function context() {
  const doc = getDoc();
  const art = doc.art.assetId ? getAssets().get(doc.art.assetId) : undefined;
  if (!art) return null;
  const clip = imageClipPolygon(doc);
  const t = doc.art.transform;
  const L = Math.max(art.width, art.height);
  return {
    doc,
    art,
    L,
    toImage: (p: Point) => toImagePoint(t, art.width, art.height, clip, p),
    perUnit: imagePixelsPerUnit(t, art.width, art.height, clip),
  };
}

/**
 * Starts a stroke (a transient change; commit when the pointer lifts).
 * `radius` is in R units, so the brush is the same size on screen at any zoom.
 * Returns the stroke's id.
 */
export function startStroke(mode: BrushStroke['mode'], p: Point, pressure: number, radius: number, softness: number): string | null {
  const c = context();
  if (!c) return null;
  const q = c.toImage(p);
  const stroke: BrushStroke = {
    id: Math.random().toString(36).slice(2, 10),
    mode,
    radius: round((radius * c.perUnit) / c.L),
    softness,
    points: [round(q.x / c.L), round(q.y / c.L), round(pressure)],
  };
  updateDoc((d) => ({ ...d, art: { ...d.art, strokes: [...d.art.strokes, stroke] } }), { transient: true });
  return stroke.id;
}

/** Adds points to the stroke being drawn. Points closer than a tenth of the brush to the last one are skipped. */
export function extendStroke(id: string, points: { p: Point; pressure: number }[]): void {
  const c = context();
  if (!c) return;
  const strokes = c.doc.art.strokes;
  const last = strokes[strokes.length - 1];
  if (!last || last.id !== id) return;
  const next = [...last.points];
  const minGap = Math.max(0.3 / c.L, last.radius * 0.1);
  for (const { p, pressure } of points) {
    const q = c.toImage(p);
    const x = q.x / c.L;
    const y = q.y / c.L;
    if (Math.hypot(x - next[next.length - 3]!, y - next[next.length - 2]!) < minGap) continue;
    next.push(round(x), round(y), round(pressure));
  }
  if (next.length === last.points.length) return;
  updateDoc((d) => ({ ...d, art: { ...d.art, strokes: [...strokes.slice(0, -1), { ...last, points: next }] } }), { transient: true });
}

/**
 * Eyedropper: removes the background colour under `p` (one undo step).
 * Returns false when the point is outside the picture.
 */
export function pickBackground(p: Point): boolean {
  const c = context();
  if (!c) return false;
  const q = c.toImage(p);
  const fx = q.x / c.art.width;
  const fy = q.y / c.art.height;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return false;
  const color = sampleOriginal(c.art, fx, fy);
  updateDoc((d) => ({ ...d, art: { ...d.art, removal: { ...d.art.removal, enabled: true, color, seed: { x: round(fx), y: round(fy) } } } }));
  return true;
}
