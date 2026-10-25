// Picking layers on the canvas, and turning a drag into new layer settings.
// Points are in pixels with the origin at the token's centre.

import type { FrameGeometry } from '../../render/frameKit';
import type { Point } from '../../render/shapes';
import type { FrameProject, Layer, PathPoint, Placement, PlacedLayer } from '../project/types';
import { acrossOfPoint, alongOfPoint, bandGeometry, bandWidthPx, insetAt, maxAcross, outlineAt } from './band';
import { flatten } from '../project/tree';
import { contourLines, lineOutline, repeatPlacements } from './layers';
import { localBounds, placement, placements, primaryPlacement, toCanvas, toLocal, unitPx } from './placed';
import { textGlyphs } from './text';
import { tracksFor, type FindLayer } from './track';
import { distanceToTrack, generatorReach } from './generators';

// (+ 0 turns −0 into 0.)
const round3 = (v: number) => Math.round(v * 1000) / 1000 + 0;

/** Distance from a point to a closed outline, in pixels. */
function distanceToOutline(points: Point[], pt: Point): number {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + dx * t - pt.x, a.y + dy * t - pt.y));
  }
  return best;
}

/** True if a point is on a shape or path layer (or one of its mirrored copies). */
export function hitsPlaced(layer: PlacedLayer, g: FrameGeometry, pt: Point, slackPx = 3): boolean {
  const box = localBounds(layer);
  return placements(layer, g).some((t) => {
    const l = toLocal(t, pt);
    const sx = slackPx / Math.max(1e-9, t.ux);
    const sy = slackPx / Math.max(1e-9, t.uy);
    return l.x >= box.minX - sx && l.x <= box.maxX + sx && l.y >= box.minY - sy && l.y <= box.maxY + sy;
  });
}

function hits(layer: Layer, g: FrameGeometry, pt: Point, find: FindLayer): boolean {
  const across = acrossOfPoint(g, pt);
  const slack = 4 / Math.max(1, bandWidthPx(g));
  switch (layer.type) {
    case 'repeat':
      return repeatPlacements(layer, g, find).some(({ p, h }) => Math.hypot(pt.x - p.x, pt.y - p.y) <= (h * Math.max(1, layer.stretch)) / 2 + 3);
    case 'line':
      if (layer.waveAmplitude > 0) return distanceToOutline(lineOutline(layer, g), pt) <= (layer.width * bandWidthPx(g)) / 2 + 4;
      return Math.abs(across - layer.at) <= layer.width / 2 + slack;
    case 'bandFill':
    case 'texture':
      return across >= Math.min(layer.from, layer.to) - slack && across <= Math.max(layer.from, layer.to) + slack;
    case 'legacyFrame':
      return across >= -slack && across <= 1 + slack;
    case 'shape':
    case 'path':
      return hitsPlaced(layer, g, pt);
    case 'text': {
      const { glyphs, height } = textGlyphs(layer, g, find);
      return glyphs.some(({ p, width }) => Math.hypot(pt.x - p.x, pt.y - p.y) <= Math.max(height, width) * 0.6 + 3);
    }
    case 'contours':
      return contourLines(layer).some((l) => Math.abs(across - l.at) <= l.width / 2 + slack);
    case 'fracture':
    case 'cells':
      return across >= Math.min(layer.from, layer.to) - slack && across <= Math.max(layer.from, layer.to) + slack;
    case 'growth':
    case 'knotwork':
    case 'gears':
    case 'chain': {
      const reach = generatorReach(layer) * bandWidthPx(g) + 4;
      return tracksFor(layer.follow, layer.at, g, find).some((t) => distanceToTrack(t, pt) <= reach);
    }
    default:
      return false;
  }
}

/** Finds layers of a project by id (the layers others follow). */
export function finder(project: FrameProject): FindLayer {
  const byId = new Map(flatten(project.layers).map((l) => [l.id, l]));
  return (id) => byId.get(id);
}

/** The top-most visible, unlocked layer under a point (inside groups too), or null. */
export function pickLayer(project: FrameProject, size: number, pt: Point): Layer | null {
  const g = bandGeometry(project.stage, size);
  const find = finder(project);
  const search = (layers: Layer[]): Layer | null => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || layer.locked) continue;
      if (layer.type === 'group') {
        const inside = search(layer.children);
        if (inside) return inside;
      } else if (hits(layer, g, pt, find)) return layer;
    }
    return null;
  };
  return search(project.layers);
}

/** Where a shape or path sits after its anchor point is moved to `pt`. */
export function placeAt(layer: PlacedLayer, g: FrameGeometry, pt: Point): Partial<Placement> {
  if (layer.place === 'free') return { x: round3(pt.x / g.R), y: round3(pt.y / g.R) };
  const across = Math.min(maxAcross(g), Math.max(-0.5, acrossOfPoint(g, pt)));
  return { across: round3(across), along: round3(alongOfPoint(outlineAt(g, across), pt)) };
}

/**
 * New settings for a layer dragged from `start` to `now`, given its settings
 * when the drag began. Dragging in or out moves it across the band; dragging
 * round the token slides a repeat's elements along it; shapes and paths move
 * with the pointer.
 */
export function dragLayer(layer: Layer, project: FrameProject, size: number, start: Point, now: Point): Partial<Layer> | null {
  const g = bandGeometry(project.stage, size);
  const dAcross = acrossOfPoint(g, now) - acrossOfPoint(g, start);
  const clamp = (v: number) => round3(Math.min(1.5, Math.max(-0.5, v)));
  switch (layer.type) {
    case 'repeat': {
      const n = Math.max(1, repeatPlacements(layer, g, finder(project)).length);
      const turn = (Math.atan2(now.y, now.x) - Math.atan2(start.y, start.x)) / (Math.PI * 2);
      const wrapped = ((turn % 1) + 1.5) % 1 - 0.5;
      // One gap is 1/n of the way round; offset is measured in gaps.
      const offset = (((layer.offset + wrapped * n) % 1) + 1) % 1;
      return { at: clamp(layer.at + dAcross), offset: round3(offset) };
    }
    case 'line':
    case 'text':
    case 'growth':
    case 'knotwork':
    case 'gears':
    case 'chain':
      return { at: clamp(layer.at + dAcross) };
    case 'fracture':
    case 'cells':
      return { from: clamp(layer.from + dAcross), to: clamp(layer.to + dAcross) };
    case 'contours':
      return { from: clamp(layer.from + dAcross) };
    case 'bandFill':
    case 'texture':
      return { from: clamp(layer.from + dAcross), to: clamp(layer.to + dAcross) };
    case 'shape':
    case 'path': {
      const t = placement(layer, g);
      if (!t) return null;
      return placeAt(layer, g, { x: t.x + now.x - start.x, y: t.y + now.y - start.y });
    }
    default:
      return null;
  }
}

/**
 * Moves a layer with the arrow keys: as if it were dragged `dx`, `dy` pixels
 * from a point on it at the top of the token (a shape or path from its
 * anchor). So ↑/↓ move a band layer out and in across the band, ←/→ slide a
 * repeat's elements round it, and shapes and paths move on the screen.
 */
export function nudgeLayer(layer: Layer, project: FrameProject, size: number, dx: number, dy: number): Partial<Layer> | null {
  const g = bandGeometry(project.stage, size);
  let start: Point;
  if (layer.type === 'shape' || layer.type === 'path') {
    const t = placement(layer, g);
    if (!t) return null;
    start = { x: t.x, y: t.y };
  } else {
    const across = 'at' in layer ? layer.at : layer.type === 'contours' ? layer.from : 'from' in layer ? (layer.from + layer.to) / 2 : 0.5;
    start = { x: 0, y: -(g.R - insetAt(g, across)) };
  }
  return dragLayer(layer, project, size, start, { x: start.x + dx, y: start.y + dy });
}

/** The editing handles of a selected shape or path, in canvas pixels. */
export interface Handles {
  anchor: Point;
  /** Corners of its box, clockwise from the top left. */
  box: Point[];
  scale: Point;
  rotate: Point;
  /** Where the line to the rotate handle starts (the middle of the box side it is beyond). */
  stem: Point;
}

/** How far the rotate handle sits beyond the box, in pixels. */
const ROTATE_GAP = 22;

export function transformHandles(layer: PlacedLayer, g: FrameGeometry, zoom = 1): Handles | null {
  const centre = placement(layer, g);
  // The box is round the layer itself, or the first copy of its radial array; the anchor stays the centre.
  const t = primaryPlacement(layer, g);
  if (!t || !centre) return null;
  const b = localBounds(layer);
  const box = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ].map((p) => toCanvas(t, p));
  // Beyond the top of its box ("up" for the layer is its local -y)… unless that is off the picture
  // (e.g. pointing outwards near the edge), then beyond the bottom.
  const up = { x: Math.sin(t.angle) * t.sy, y: -Math.cos(t.angle) * t.sy };
  const top = toCanvas(t, { x: (b.minX + b.maxX) / 2, y: b.minY });
  const rotate = { x: top.x + up.x * ROTATE_GAP * zoom, y: top.y + up.y * ROTATE_GAP * zoom };
  const margin = 10 * zoom;
  if (Math.abs(rotate.x) > g.R - margin || Math.abs(rotate.y) > g.R - margin) {
    const bottom = toCanvas(t, { x: (b.minX + b.maxX) / 2, y: b.maxY });
    return { anchor: { x: centre.x, y: centre.y }, box, scale: box[2], rotate: { x: bottom.x - up.x * ROTATE_GAP * zoom, y: bottom.y - up.y * ROTATE_GAP * zoom }, stem: bottom };
  }
  return { anchor: { x: centre.x, y: centre.y }, box, scale: box[2], rotate, stem: top };
}

/** New size from dragging the scale handle: grows with the pointer's distance from the anchor. */
export function scaleBy(layer: PlacedLayer, anchor: Point, start: Point, now: Point): Partial<Placement> {
  const d0 = Math.hypot(start.x - anchor.x, start.y - anchor.y);
  const d1 = Math.hypot(now.x - anchor.x, now.y - anchor.y);
  if (d0 < 1) return {};
  return { size: round3(Math.min(5, Math.max(0.01, layer.size * (d1 / d0)))) };
}

/** New rotation from dragging the rotate handle round the anchor; `snap` rounds to 15°. */
export function rotateBy(layer: PlacedLayer, anchor: Point, start: Point, now: Point, snap = false): Partial<Placement> {
  const delta = ((Math.atan2(now.y - anchor.y, now.x - anchor.x) - Math.atan2(start.y - anchor.y, start.x - anchor.x)) * 180) / Math.PI;
  let r = layer.rotation + delta;
  r = ((((r + 180) % 360) + 360) % 360) - 180;
  return { rotation: snap ? Math.round(r / 15) * 15 : Math.round(r * 10) / 10 };
}

// ---- Path points ----

export type PathPart = { point: number; part: 'point' | 'in' | 'out' };

/** The path's points and curve handles in canvas pixels (for the layer itself, not its mirrored copies). */
export function pathHandles(layer: PlacedLayer & { points: PathPoint[] }, g: FrameGeometry) {
  const t = primaryPlacement(layer, g);
  if (!t) return [];
  return layer.points.map((p) => ({
    at: toCanvas(t, p),
    out: p.handle ? toCanvas(t, { x: p.x + p.handle.x, y: p.y + p.handle.y }) : null,
    in: p.handle ? toCanvas(t, p.handleIn ? { x: p.x + p.handleIn.x, y: p.y + p.handleIn.y } : { x: p.x - p.handle.x, y: p.y - p.handle.y }) : null,
  }));
}

/** Which point or handle of a path is under the pointer (handles of the chosen point first). */
export function pickPathPart(layer: PlacedLayer & { points: PathPoint[] }, g: FrameGeometry, pt: Point, chosen: number | null, radius = 7): PathPart | null {
  const all = pathHandles(layer, g);
  const near = (q: Point | null) => !!q && Math.hypot(q.x - pt.x, q.y - pt.y) <= radius;
  const order = chosen !== null && chosen < all.length ? [chosen, ...all.keys()] : [...all.keys()];
  for (const i of order) {
    if (near(all[i].out)) return { point: i, part: 'out' };
    if (near(all[i].in)) return { point: i, part: 'in' };
  }
  for (let i = all.length - 1; i >= 0; i--) if (near(all[i].at)) return { point: i, part: 'point' };
  return null;
}

/** A canvas point in the path's own units (where a new point goes), or null if the path can't be placed. */
export function pathLocal(layer: PlacedLayer, g: FrameGeometry, pt: Point): Point | null {
  const t = primaryPlacement(layer, g);
  if (!t) return null;
  const l = toLocal(t, pt);
  return { x: round3(l.x), y: round3(l.y) };
}

/**
 * The points after dragging a point or handle to `pt`. A point's two
 * handles move together (mirrored) unless they are separate, or `separate`
 * (Alt held) makes them so: then each handle moves on its own.
 */
export function movePathPart(layer: PlacedLayer & { points: PathPoint[] }, g: FrameGeometry, part: PathPart, pt: Point, separate = false): PathPoint[] | null {
  const l = pathLocal(layer, g, pt);
  if (!l) return null;
  return layer.points.map((p, i) => {
    if (i !== part.point) return p;
    if (part.part === 'point') return { ...p, x: l.x, y: l.y };
    const to = { x: round3(l.x - p.x), y: round3(l.y - p.y) };
    if (p.handleIn || separate) {
      const handleIn = p.handleIn ?? (p.handle ? { x: -p.handle.x, y: -p.handle.y } : to);
      return part.part === 'out' ? { ...p, handle: to, handleIn } : { ...p, handleIn: to };
    }
    const sign = part.part === 'out' ? 1 : -1;
    return { ...p, handle: { x: to.x * sign, y: to.y * sign } };
  });
}

/** A smooth point's handles made separate (each moves on its own) or joined again (the arriving one mirrors the leaving one). */
export function toggleSeparate(points: PathPoint[], i: number): PathPoint[] {
  return points.map((p, k) => {
    if (k !== i || !p.handle) return p;
    if (p.handleIn) return { x: p.x, y: p.y, handle: p.handle };
    return { ...p, handleIn: { x: 0 - p.handle.x, y: 0 - p.handle.y } };
  });
}

/**
 * Turns a layer round the token's centre by `degrees` (clockwise): band
 * positions slide round, free shapes move round the centre and turn. Used
 * to turn a whole group (version 8). Layers whose look doesn't depend on
 * where round the token they are (bands, lines, textures) are unchanged.
 */
export function turnLayer(layer: Layer, degrees: number, n: number): Partial<Layer> | null {
  const k = degrees / 360;
  const wrap = (v: number) => round3(((v % 1) + 1) % 1);
  switch (layer.type) {
    case 'shape':
    case 'path': {
      if (layer.place === 'band') return { along: wrap(layer.along + k) };
      const a = (degrees * Math.PI) / 180;
      return { x: round3(layer.x * Math.cos(a) - layer.y * Math.sin(a)), y: round3(layer.x * Math.sin(a) + layer.y * Math.cos(a)), rotation: Math.round((layer.rotation + degrees) * 10) / 10 };
    }
    case 'repeat':
    case 'gears':
      return layer.follow ? null : { offset: wrap(layer.offset + k * n) };
    case 'text':
      return layer.follow ? null : { along: wrap(layer.along + k) };
    case 'line':
      return layer.waveAmplitude > 0 ? { wavePhase: wrap(layer.wavePhase + k * layer.waves) } : null;
    default:
      return null;
  }
}

/** Turns a sharp point into a smooth one (a handle along its neighbours) or back. */
export function toggleSmooth(points: PathPoint[], i: number, closed: boolean): PathPoint[] {
  return points.map((p, k) => {
    if (k !== i) return p;
    if (p.handle) return { x: p.x, y: p.y, handle: null };
    const n = points.length;
    const prev = points[i > 0 ? i - 1 : closed ? n - 1 : i];
    const next = points[i < n - 1 ? i + 1 : closed ? 0 : i];
    let hx = (next.x - prev.x) / 4;
    let hy = (next.y - prev.y) / 4;
    if (Math.hypot(hx, hy) < 1e-6) [hx, hy] = [0.3, 0];
    return { ...p, handle: { x: round3(hx), y: round3(hy) } };
  });
}

const normDeg = (d: number) => Math.round((((((d + 180) % 360) + 360) % 360) - 180) * 10) / 10;

/** Switches a shape or path between band and free placement without it moving, turning or changing size on screen. */
export function switchPlace(layer: PlacedLayer, g: FrameGeometry): Partial<Placement> {
  const t = placement(layer, g);
  const px = unitPx(layer, g);
  if (!t) return { place: layer.place === 'band' ? 'free' : 'band' };
  if (layer.place === 'band') {
    return { place: 'free', x: round3(t.x / g.R), y: round3(t.y / g.R), size: round3((px * 2) / g.R), rotation: normDeg((t.angle * 180) / Math.PI) };
  }
  const banded = { ...layer, place: 'band', ...placeAt({ ...layer, place: 'band' }, g, { x: t.x, y: t.y }) } as PlacedLayer;
  const there = placement({ ...banded, rotation: 0 } as PlacedLayer, g);
  return {
    place: 'band',
    along: banded.along,
    across: banded.across,
    size: round3((px * 2) / Math.max(1e-9, bandWidthPx(g))),
    rotation: there ? normDeg(((t.angle - there.angle) * 180) / Math.PI) : layer.rotation,
  };
}

/**
 * Moves a path's anchor to the middle of its points without moving the
 * drawing, so it turns and grows about its centre. Used when drawing ends
 * (the first click anchored it).
 */
export function recentrePath(layer: PlacedLayer & { points: PathPoint[] }, g: FrameGeometry): Partial<Placement> & { points?: PathPoint[] } {
  const t = placement(layer, g);
  if (!t || layer.points.length === 0) return {};
  const b = localBounds(layer);
  const centre = toCanvas(t, { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  const moved = { ...layer, ...placeAt(layer, g, centre) } as PlacedLayer;
  const t2 = placement(moved, g);
  if (!t2) return {};
  const points = layer.points.map((p) => {
    const at = toLocal(t2, toCanvas(t, p));
    const handle = p.handle ? toLocal(t2, toCanvas(t, { x: p.x + p.handle.x, y: p.y + p.handle.y })) : null;
    return { x: round3(at.x), y: round3(at.y), handle: handle ? { x: round3(handle.x - at.x), y: round3(handle.y - at.y) } : null };
  });
  return layer.place === 'free' ? { x: moved.x, y: moved.y, points } : { along: moved.along, across: moved.across, points };
}
