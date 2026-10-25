// Generators (DESIGN.md §5.7): intricate geometry from a few numbers, drawn
// as ordinary filled shapes so effects and styles work on them. Every one is
// seeded, so the preview, the export and the tests draw the same picture,
// and sized in band widths along a track (the band or a followed layer).

import { shade } from '../../render/color';
import { ornamentCount, seededRandom, sphere, type FrameGeometry } from '../../render/frameKit';
import type { PerimeterSample, Point } from '../../render/shapes';
import type { CellsLayer, ChainLayer, FractureLayer, GearsLayer, GrowthLayer, KnotworkLayer } from '../project/types';
import { acrossOfPoint, bandWidthPx, outlineAt, spacedAlong } from './band';
import type { Ctx } from './canvas';
import { shadedFill } from './elements';
import { clipHalfPlane, insetConvex, noise1, ribbon, roundCorners, tracePoly } from './geometry';
import { lightAt, turn } from './light';
import { findNothing, followed, pointAlong, spacedOnTrack, trackLength, tracksFor, type FindLayer, type Track } from './track';

const TAU = Math.PI * 2;

/** A point `off` pixels inwards (to the right of travel) from a point on a track. */
const inwards = (p: PerimeterSample, off: number): Point => ({ x: p.x - Math.sin(p.angle) * off, y: p.y + Math.cos(p.angle) * off });

/** A centre line with a width at each point. */
export interface Strand {
  points: Point[];
  widths: number[];
  closed: boolean;
}

function fillStrand(ctx: Ctx, s: Strand): void {
  ctx.beginPath();
  if (s.closed && s.widths.every((w) => w === s.widths[0])) {
    // An even closed stem: one stroke, so it has no seam.
    tracePoly(ctx, s.points);
    ctx.lineWidth = s.widths[0];
    ctx.lineJoin = 'round';
    ctx.stroke();
    return;
  }
  tracePoly(ctx, ribbon(s.points, s.widths));
  ctx.fill();
}

// ---------------------------------------------------------------- growth

export interface GrowthExtraMark {
  p: PerimeterSample;
  side: 1 | -1;
  size: number;
}

export interface GrowthShape {
  strands: Strand[];
  extras: GrowthExtraMark[];
}

/** The stems, branches and leaves (or thorns, berries) of a growth layer, in pixels. */
export function growthShape(layer: GrowthLayer, g: FrameGeometry, find: FindLayer = findNothing): GrowthShape {
  const bw = bandWidthPx(g);
  const random = seededRandom(layer.seed * 7919 + 0x9a0);
  const strands: Strand[] = [];
  const extras: GrowthExtraMark[] = [];
  const curlRad = (layer.curl * Math.PI) / 180;

  /** One branch from `start`, heading `heading`, curling to `side`; branches of its own below `depth`. */
  const grow = (start: Point, heading: number, length: number, width: number, side: 1 | -1, level: number, tines = false): void => {
    const steps = Math.max(4, Math.ceil(length / Math.max(1, bw * 0.05)));
    const ds = length / steps;
    const pts: Point[] = [start];
    const ws: number[] = [width];
    let h = heading;
    const nseed = Math.floor(random() * 99999);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const spiral = layer.kind === 'tendrils' ? 0.3 + 2.6 * t * t : 1;
      h += (curlRad * spiral * side * ds) / bw + layer.gnarl * 0.9 * noise1((k * ds) / (bw * 0.25), nseed) * (ds / bw);
      const last = pts[pts.length - 1];
      pts.push({ x: last.x + Math.cos(h) * ds, y: last.y + Math.sin(h) * ds });
      ws.push(Math.max(0.4, width * (1 - layer.taper * t)));
    }
    strands.push({ points: pts, widths: ws, closed: false });
    const tip = pts[pts.length - 1];
    const before = pts[pts.length - 2];
    if (layer.extra === 'leaves' || layer.extra === 'berries') extras.push({ p: { ...tip, angle: Math.atan2(tip.y - before.y, tip.x - before.x) }, side, size: layer.extraSize * bw * (level > 1 ? 0.7 : 1) });
    if (level >= layer.depth) return;
    // Tines grow from one side of an antler's beam; other branches fork either way.
    const forks = tines ? [0.32, 0.55, 0.78] : [0.45, 0.75];
    forks.forEach((at, j) => {
      if (!tines && random() > layer.branching) return;
      const i = Math.round(at * steps);
      const a = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      const s: 1 | -1 = tines ? side : j % 2 ? side : ((-side) as 1 | -1);
      grow(pts[i], a + (s * layer.branchAngle * Math.PI) / 180, length * (tines ? 0.45 - j * 0.06 : 0.55), ws[i] * 0.75, s, level + 1);
    });
  };

  const tracks = tracksFor(layer.follow, layer.at, g, find);
  const onBand = !followed(layer.follow, find);
  for (const track of tracks) {
    const L = trackLength(track);
    if (L <= 0) continue;
    if (layer.kind === 'antlers') {
      const n = onBand ? ornamentCount(g.shape, layer.count) : layer.count;
      spacedOnTrack(track, n, track.closed ? 0.5 : 0).forEach((p, i) => {
        if (!p) return;
        const side: 1 | -1 = i % 2 ? 1 : -1;
        // The beam grows outwards (local −y) and leans along the band.
        grow(p, p.angle - Math.PI / 2 + side * 0.35, layer.branchLength * bw, layer.thickness * bw, side, 1, true);
      });
      continue;
    }
    const waves = layer.waveLength > 0 ? (track.closed ? Math.max(1, Math.round(L / (layer.waveLength * bw))) : L / (layer.waveLength * bw)) : 0;
    const amp = layer.amplitude * bw;
    for (let c = 0; c < layer.count; c++) {
      const phase = c / layer.count;
      const nseed = layer.seed * 31 + c;
      const offAt = (d: number) =>
        amp * Math.sin(TAU * (waves * (d / L) + phase)) + layer.gnarl * bw * (0.2 * noise1(d / (bw * 0.7), nseed) + 0.07 * noise1(d / (bw * 0.18), nseed + 50));
      const N = Math.max(24, Math.ceil(L / Math.max(1, bw * 0.05)));
      const pts: Point[] = [];
      const ws: number[] = [];
      for (let i = 0; i < (track.closed ? N : N + 1); i++) {
        const d = (i / N) * L;
        const p = pointAlong(track, Math.min(d, L - 1e-6));
        if (!p) continue;
        pts.push(inwards(p, offAt(d)));
        ws.push(layer.thickness * bw * (track.closed ? 1 : 1 - layer.taper * 0.7 * (d / L)));
      }
      strands.push({ points: pts, widths: ws, closed: track.closed });
      const stemAt = (d: number): PerimeterSample | null => {
        const p = pointAlong(track, d);
        if (!p) return null;
        const q = inwards(p, offAt(d));
        const ahead = inwards(pointAlong(track, d + 1) ?? p, offAt(d + 1));
        return { x: q.x, y: q.y, angle: d + 1 <= L || track.closed ? Math.atan2(ahead.y - q.y, ahead.x - q.x) : p.angle };
      };
      // Branches.
      if (layer.branching > 0) {
        const sites = Math.round((L / bw) * layer.branching * 1.4);
        for (let s = 0; s < sites; s++) {
          const d = ((s + 0.5 + (random() - 0.5) * 0.7) / sites) * L;
          const p = stemAt(Math.max(0, Math.min(L - 1, d)));
          if (!p) continue;
          const side: 1 | -1 = layer.kind === 'vine' ? (s % 2 ? 1 : -1) : random() < 0.5 ? 1 : -1;
          grow(p, p.angle + (side * layer.branchAngle * Math.PI) / 180, layer.branchLength * bw * (0.6 + random() * 0.8), layer.thickness * bw * 0.7, side, 1);
        }
      }
      // Leaves, thorns or berries along the stem, alternating sides; on a wavy stem in step with its waves.
      if (layer.extra !== 'none' && c === 0) {
        const spacing = layer.extraSpacing * bw;
        const n = waves > 0 && track.closed ? Math.round(waves) * Math.max(1, Math.round((L / waves) / spacing)) : Math.max(1, Math.round(L / spacing));
        for (let j = 0; j < n; j++) {
          const d = (j / n) * L;
          const p = stemAt(d);
          const along = pointAlong(track, d);
          // Turned with the track (not the wave), as Token Maker's Druid turns its leaves.
          if (p && along) extras.push({ p: { ...p, angle: along.angle }, side: j % 2 ? 1 : -1, size: layer.extraSize * bw });
        }
      }
    }
  }
  return { strands, extras };
}

/** A leaf as Token Maker's Druid draws it: from its stalk along +x, `size` long. */
function traceLeaf(ctx: Ctx, size: number, side: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.472, side * size * 0.333, size, 0);
  ctx.quadraticCurveTo(size * 0.472, -side * size * 0.333, 0, 0);
}

export function drawGrowth(ctx: Ctx, layer: GrowthLayer, g: FrameGeometry, light: number, find: FindLayer = findNothing): void {
  const { strands, extras } = growthShape(layer, g, find);
  const bw = bandWidthPx(g);
  ctx.save();
  ctx.fillStyle = layer.color;
  ctx.strokeStyle = layer.color;
  for (const s of strands) fillStrand(ctx, s);
  for (const { p, side, size } of extras) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const l = lightAt(p, light);
    if (layer.extra === 'leaves') {
      ctx.translate(0, side * bw * 0.1);
      ctx.rotate(side * 0.9);
      traceLeaf(ctx, size, side);
      ctx.translate(size / 2, 0);
      shadedFill(ctx, layer.extraColor, size, size * 0.66, turn(l, -side * 0.9));
    } else if (layer.extra === 'thorns') {
      const w = layer.thickness * bw * 0.5;
      ctx.beginPath();
      ctx.moveTo(-size * 0.2, side * w * 0.8);
      ctx.lineTo(size * 0.2, side * w * 0.8);
      ctx.lineTo(size * 0.12, side * (w + size));
      ctx.closePath();
      shadedFill(ctx, layer.extraColor, size * 0.4, size, l);
    } else if (layer.extra === 'berries') {
      sphere(ctx, 0, side * size * 0.3, size * 0.28, layer.extraColor, l);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- cracks and lightning

/** The cracks or bolts of a fracture layer, as tapering centre lines in pixels. */
export function fractureStrands(layer: FractureLayer, g: FrameGeometry): Strand[] {
  const bw = bandWidthPx(g);
  const random = seededRandom(layer.seed * 104729 + 0xc4a);
  const lo = Math.min(layer.from, layer.to);
  const hi = Math.max(layer.from, layer.to);
  const out: Strand[] = [];
  const pointAt = (frac: number, across: number): PerimeterSample | null => spacedAlong(outlineAt(g, across), 1, ((frac % 1) + 1) % 1)[0] ?? null;

  if (layer.kind === 'cracks') {
    const walk = (start: Point, heading: number, length: number, width: number, level: number) => {
      const seg = bw * 0.06;
      const steps = Math.max(2, Math.round(length / seg));
      const pts = [start];
      const ws = [width];
      let h = heading;
      for (let k = 1; k <= steps; k++) {
        h += (random() - 0.5) * layer.jagged * 1.6;
        const last = pts[pts.length - 1];
        const next = { x: last.x + Math.cos(h) * seg, y: last.y + Math.sin(h) * seg };
        const a = acrossOfPoint(g, next);
        // Cracks stop at the edge of their part of the band.
        if (a < lo - 0.01 || a > hi + 0.01) break;
        pts.push(next);
        ws.push(Math.max(0.5, width * (1 - (0.85 * k) / steps)));
        if (level < 2 && random() < layer.branching * 0.07) walk(next, h + (random() < 0.5 ? -1 : 1) * (0.5 + random() * 0.5), length * (1 - k / steps) * 0.7, ws[ws.length - 1] * 0.7, level + 1);
      }
      if (pts.length > 1) out.push({ points: pts, widths: ws, closed: false });
    };
    for (let i = 0; i < layer.count; i++) {
      const p = pointAt(random(), lo + (hi - lo) * random());
      if (p) walk(p, random() * TAU, layer.length * bw * (0.6 + random() * 0.8), layer.width * bw, 0);
    }
    return out;
  }
  // Lightning: bolts running round the band, zigzagging across it and forking.
  const mid = outlineAt(g, (lo + hi) / 2);
  const U = mid.length ? trackLength({ points: mid, closed: true }) : 0;
  if (U <= 0) return out;
  const bolt = (frac: number, across: number, length: number, width: number, drift: number, level: number) => {
    const seg = bw * 0.16;
    const steps = Math.max(2, Math.round(length / seg));
    const pts: Point[] = [];
    const ws: number[] = [];
    let v = across;
    for (let k = 0; k <= steps; k++) {
      const p = pointAt(frac + (k * seg) / U, v);
      if (!p) break;
      pts.push(p);
      ws.push(Math.max(0.5, width * (1 - (0.7 * k) / steps)));
      v = Math.max(lo, Math.min(hi, v + drift * 0.04 + (random() - 0.5) * layer.jagged * 0.45));
      if (level < 2 && k > 0 && random() < layer.branching * 0.12) bolt(frac + (k * seg) / U, v, length * (1 - k / steps) * 0.55, ws[ws.length - 1] * 0.6, random() < 0.5 ? -1 : 1, level + 1);
    }
    if (pts.length > 1) out.push({ points: pts, widths: ws, closed: false });
  };
  for (let i = 0; i < layer.count; i++) bolt((i + random() * 0.5) / layer.count, lo + (hi - lo) * (0.3 + random() * 0.4), layer.length * bw * (0.7 + random() * 0.6), layer.width * bw, 0, 0);
  return out;
}

export function drawFracture(ctx: Ctx, layer: FractureLayer, g: FrameGeometry): void {
  ctx.save();
  ctx.fillStyle = layer.color;
  for (const s of fractureStrands(layer, g)) fillStrand(ctx, s);
  ctx.restore();
}

// ---------------------------------------------------------------- plates and cells

export interface Cell {
  points: Point[];
  color: string;
}

/**
 * The band between `from` and `to` divided into separate plates. Cells are
 * made flat (u along the band, v across it, in pixels at the band's middle)
 * so they wrap round seamlessly, then laid onto the band: each corner goes
 * to the same share of the way round at its own across position, so cells
 * follow every token shape.
 */
export function cellShapes(layer: CellsLayer, g: FrameGeometry): Cell[] {
  const bw = bandWidthPx(g);
  const lo = Math.min(layer.from, layer.to);
  const hi = Math.max(layer.from, layer.to);
  const mid = outlineAt(g, (lo + hi) / 2);
  if (mid.length < 2 || hi - lo <= 0) return [];
  const U = trackLength({ points: mid, closed: true });
  const V = (hi - lo) * bw;
  const random = seededRandom(layer.seed * 15485863 + 0xce11);
  const cellPx = layer.size * bw;
  const cols = Math.max(3, Math.round(U / cellPx));
  const rows = Math.max(1, Math.round(V / cellPx));
  const cw = U / cols;
  const rh = V / rows;
  const flat: Point[][] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  switch (layer.pattern) {
    case 'grid':
    case 'brick':
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const shift = layer.pattern === 'brick' && r % 2 ? cw / 2 : 0;
          flat.push(rect(c * cw + shift, r * rh, (c + 1) * cw + shift, (r + 1) * rh));
        }
      break;
    case 'hex': {
      const hRows = Math.max(1, Math.round(V / (cellPx * 0.75)));
      const step = V / hRows;
      const H = step / 0.75;
      for (let r = -1; r <= hRows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * cw + (r % 2 ? cw / 2 : 0) + cw / 2;
          const y = (r + 0.5) * step;
          let hex = [
            { x, y: y - H / 2 },
            { x: x + cw / 2, y: y - H / 4 },
            { x: x + cw / 2, y: y + H / 4 },
            { x, y: y + H / 2 },
            { x: x - cw / 2, y: y + H / 4 },
            { x: x - cw / 2, y: y - H / 4 },
          ];
          hex = clipHalfPlane(clipHalfPlane(hex, 0, -1, 0), 0, 1, V);
          if (hex.length >= 3) flat.push(hex);
        }
      break;
    }
    case 'scales':
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * cw + (r % 2 ? cw / 2 : 0) + cw / 2;
          const y0 = r * rh;
          // A rounded scale, its point inwards; the next row overlaps its top.
          const pts: Point[] = [{ x: x - cw / 2, y: y0 }, { x: x + cw / 2, y: y0 }];
          for (let k = 0; k <= 8; k++) {
            const a = (k / 8) * Math.PI;
            pts.push({ x: x + Math.cos(a) * (cw / 2), y: Math.min(V, y0 + rh * 0.35 + Math.sin(a) * rh * 0.8) });
          }
          flat.push(pts);
        }
      break;
    case 'voronoi': {
      // One point per cell of a grid, moved at random; each plate is what is nearer its point than any other.
      const seeds: Point[][] = [];
      for (let r = 0; r < rows; r++) {
        seeds.push([]);
        for (let c = 0; c < cols; c++) seeds[r].push({ x: (c + 0.5 + (random() - 0.5) * layer.jitter) * cw, y: (r + 0.5 + (random() - 0.5) * layer.jitter * 0.9) * rh });
      }
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const p = seeds[r][c];
          let poly = rect(p.x - cw * 3, -1, p.x + cw * 3, V + 1);
          for (let dr = -2; dr <= 2; dr++)
            for (let dc = -2; dc <= 2; dc++) {
              if (!dr && !dc) continue;
              const rr = r + dr;
              if (rr < 0 || rr >= rows) continue;
              // Wrapping round the ring.
              const cc = (((c + dc) % cols) + cols) % cols;
              const q = { x: seeds[rr][cc].x + Math.floor((c + dc) / cols) * U, y: seeds[rr][cc].y };
              const nx = q.x - p.x;
              const ny = q.y - p.y;
              poly = clipHalfPlane(poly, nx, ny, (nx * (p.x + q.x) + ny * (p.y + q.y)) / 2);
            }
          poly = clipHalfPlane(clipHalfPlane(poly, 0, -1, 0), 0, 1, V);
          if (poly.length >= 3) flat.push(poly);
        }
      break;
    }
  }
  const gap = (layer.gap * bw) / 2;
  const out: Cell[] = [];
  for (const cell of flat) {
    const keep = random();
    const tint = random();
    if (keep < layer.missing) continue;
    const inset = layer.pattern === 'scales' ? cell : insetConvex(cell, gap);
    if (inset.length < 3) continue;
    // Each side cut into short pieces so it bends with the band.
    const laid: Point[] = [];
    inset.forEach((a, i) => {
      const b = inset[(i + 1) % inset.length];
      const pieces = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (bw * 0.12)));
      for (let k = 0; k < pieces; k++) {
        const t = k / pieces;
        const u = a.x + (b.x - a.x) * t;
        const v = a.y + (b.y - a.y) * t;
        const p = spacedAlong(outlineAt(g, lo + v / bw), 1, ((u / U) % 1 + 1) % 1)[0];
        if (p) laid.push({ x: p.x, y: p.y });
      }
    });
    if (laid.length < 3) continue;
    out.push({ points: roundCorners(laid, layer.rounding * Math.min(cw, rh) * 0.35), color: shade(layer.color, (tint - 0.5) * layer.vary * 0.7) });
  }
  return out;
}

export function drawCells(ctx: Ctx, layer: CellsLayer, g: FrameGeometry): void {
  ctx.save();
  for (const c of cellShapes(layer, g)) {
    ctx.beginPath();
    tracePoly(ctx, c.points);
    ctx.fillStyle = c.color;
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- knotwork

interface KnotArc {
  points: Point[];
}

/**
 * Two strands swinging across a track in opposite phase. They cross twice a
 * wave; at each crossing one passes over and the other stops short on both
 * sides of it, the over strand taking turns, so every strand goes over,
 * under, over… (a real interlace).
 */
export function knotArcs(layer: KnotworkLayer, g: FrameGeometry, find: FindLayer = findNothing): KnotArc[] {
  const bw = bandWidthPx(g);
  const arcs: KnotArc[] = [];
  for (const track of tracksFor(layer.follow, layer.at, g, find)) {
    const L = trackLength(track);
    if (L <= 0) continue;
    const waves = track.closed ? Math.max(2, Math.round(L / (layer.waveLength * bw))) : L / (layer.waveLength * bw);
    const amp = layer.amplitude * bw;
    const half = L / (2 * waves);
    // The under strand stops where it would touch the over strand's edge: at a crossing the strands
    // part at a rate set by their slope, so the gap along the track is the edge's reach over that rate.
    const slope = (amp * Math.PI) / Math.max(1e-6, half);
    const parting = (2 * slope) / Math.sqrt(1 + slope * slope);
    const gap = ((layer.width / 2 + layer.outlineWidth) * bw) / Math.max(0.3, parting) + bw * 0.015;
    const step = Math.max(1, bw * 0.03);
    const strandPoint = (k: number, d: number): Point | null => {
      const p = pointAlong(track, d);
      return p ? inwards(p, amp * Math.sin(TAU * waves * (d / L) + k * Math.PI)) : null;
    };
    const crossings = Math.floor(L / half + 1e-6);
    for (let k = 0; k < 2; k++) {
      // Strand k goes under at every other crossing; its arcs run from one of those to the next.
      const under: number[] = [];
      for (let c = 0; c <= crossings; c++) if ((c + k + (layer.flip ? 1 : 0)) % 2 === 1) under.push(c * half);
      const ends = track.closed ? under : [-gap, ...under, L + gap];
      const n = track.closed ? ends.length : ends.length - 1;
      for (let i = 0; i < n; i++) {
        const a = ends[i] + gap;
        let b = track.closed && i === ends.length - 1 ? ends[0] + L - gap : ends[i + 1] - gap;
        if (!track.closed) b = Math.min(b, L);
        const pts: Point[] = [];
        for (let d = Math.max(a, track.closed ? a : 0); d <= b; d += step) {
          const p = strandPoint(k, track.closed ? d % L : d);
          if (p) pts.push(p);
        }
        if (pts.length > 1) arcs.push({ points: pts });
      }
    }
  }
  return arcs;
}

export function drawKnotwork(ctx: Ctx, layer: KnotworkLayer, g: FrameGeometry, find: FindLayer = findNothing): void {
  const bw = bandWidthPx(g);
  const arcs = knotArcs(layer, g, find);
  const stroke = (pts: Point[], width: number, color: string, alpha = 1) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  for (const { points } of arcs) {
    if (layer.outline && layer.outlineWidth > 0) stroke(points, (layer.width + layer.outlineWidth * 2) * bw, layer.outline, layer.outlineOpacity);
    stroke(points, layer.width * bw, layer.color);
    if (layer.double && layer.outline) stroke(points, layer.width * bw * 0.22, layer.outline, layer.outlineOpacity);
    if (layer.shine) stroke(points, Math.max(0.5, bw * 0.04), shade(layer.color, 0.6), 0.6);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- gears

export interface GearPlacement {
  p: PerimeterSample;
  /** Outer radius, pixels. */
  r: number;
  /** Turn, radians. */
  turn: number;
}

export function gearPlacements(layer: GearsLayer, g: FrameGeometry, find: FindLayer = findNothing): GearPlacement[] {
  const bw = bandWidthPx(g);
  const onBand = !followed(layer.follow, find);
  const out: GearPlacement[] = [];
  let index = 0;
  for (const track of tracksFor(layer.follow, layer.at, g, find)) {
    const n = onBand && layer.snapToCorners ? ornamentCount(g.shape, layer.count) : layer.count;
    spacedOnTrack(track, n, layer.offset).forEach((p) => {
      const i = index++;
      if (!p) return;
      const big = i % 2 === 1 ? layer.altSize : 1;
      out.push({ p, r: (layer.size * bw * big) / 2, turn: (layer.rotation * Math.PI) / 180 + (layer.interlock && i % 2 ? Math.PI / layer.teeth : 0) });
    });
  }
  return out;
}

/** One gear's outline (teeth), centred on the origin. */
function traceTeeth(ctx: Ctx, layer: GearsLayer, r: number): void {
  const root = r * (1 - layer.toothDepth);
  const n = layer.teeth;
  if (layer.toothShape === 'pointed') {
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const rr = i % 2 ? root : r;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, Math.cos(a) * rr, Math.sin(a) * rr);
    }
  } else
    for (let i = 0; i < n * 4; i++) {
      const a = ((i - 0.5) / (n * 4)) * TAU;
      const rr = i % 4 < 2 ? r : root;
      (i ? ctx.lineTo : ctx.moveTo).call(ctx, Math.cos(a) * rr, Math.sin(a) * rr);
    }
  ctx.closePath();
}

export function drawGears(ctx: Ctx, layer: GearsLayer, g: FrameGeometry, light: number, find: FindLayer = findNothing): void {
  ctx.save();
  for (const { p, r, turn: t } of gearPlacements(layer, g, find)) {
    const root = r * (1 - layer.toothDepth);
    const l = lightAt(p, light);
    const local = turn(l, -t);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + t);
    ctx.beginPath();
    traceTeeth(ctx, layer, r);
    if (layer.spokes > 0) {
      // A rim: the middle cut out, drawn the other way round so it stays empty.
      const inner = root * 0.72;
      ctx.moveTo(inner, 0);
      ctx.arc(0, 0, inner, 0, -TAU, true);
    }
    shadedFill(ctx, layer.color, r * 2, r * 2, local, 'nonzero', layer.shaded);
    if (layer.spokes > 0) {
      ctx.beginPath();
      const sw = root * 0.16;
      for (let k = 0; k < layer.spokes; k++) {
        ctx.save();
        ctx.rotate((k / layer.spokes) * TAU);
        ctx.rect(0, -sw / 2, root * 0.8, sw);
        ctx.restore();
      }
      ctx.moveTo(root * Math.max(0.12, layer.hub), 0);
      ctx.arc(0, 0, root * Math.max(0.12, layer.hub), 0, TAU);
      shadedFill(ctx, layer.color, r * 2, r * 2, local, 'nonzero', layer.shaded);
    }
    if (layer.domed) sphere(ctx, 0, 0, root * 0.8, shade(layer.color, -0.15), local);
    if (layer.hub > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, root * (layer.spokes > 0 ? layer.hub * 0.4 : layer.hub), 0, TAU);
      ctx.fillStyle = shade(layer.color, -0.7);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- chains

export interface ChainLink {
  p: PerimeterSample;
  /** Face-on (an oval ring) or edge-on (a bar). */
  face: boolean;
}

export function chainLinks(layer: ChainLayer, g: FrameGeometry, find: FindLayer = findNothing): ChainLink[] {
  const bw = bandWidthPx(g);
  const out: ChainLink[] = [];
  for (const track of tracksFor(layer.follow, layer.at, g, find)) {
    const L = trackLength(track);
    // Links overlap by a quarter, and a closed chain needs an even number so faces and edges alternate all the way round.
    let n = Math.max(4, Math.round(L / (layer.linkLength * bw * 0.72)));
    if (track.closed && n % 2) n++;
    spacedOnTrack(track, n).forEach((p, i) => p && out.push({ p, face: i % 2 === 0 }));
  }
  return out;
}

export function drawChain(ctx: Ctx, layer: ChainLayer, g: FrameGeometry, light: number, find: FindLayer = findNothing): void {
  const bw = bandWidthPx(g);
  const len = layer.linkLength * bw;
  const wid = len * layer.linkWidth;
  const t = layer.thickness * bw;
  const links = chainLinks(layer, g, find);
  const ring = (link: ChainLink, half: 'all' | 'back') => {
    ctx.save();
    ctx.translate(link.p.x, link.p.y);
    ctx.rotate(link.p.angle);
    if (half === 'back') {
      // The trailing half passes over the link before it.
      ctx.beginPath();
      ctx.rect(-len, -wid, len, wid * 2);
      ctx.clip();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, TAU);
    ctx.ellipse(0, 0, Math.max(0.5, len / 2 - t), Math.max(0.5, wid / 2 - t), 0, 0, TAU, true);
    shadedFill(ctx, layer.color, len, wid, lightAt(link.p, light), 'nonzero', layer.shaded);
    ctx.restore();
  };
  ctx.save();
  for (const l of links) if (l.face) ring(l, 'all');
  for (const l of links) {
    if (l.face) continue;
    ctx.save();
    ctx.translate(l.p.x, l.p.y);
    ctx.rotate(l.p.angle);
    ctx.beginPath();
    ctx.roundRect(-len / 2, -t * 0.6, len, t * 1.2, t * 0.6);
    shadedFill(ctx, shade(layer.color, -0.12), len, t * 1.2, lightAt(l.p, light), 'nonzero', layer.shaded);
    ctx.restore();
  }
  for (const l of links) if (l.face) ring(l, 'back');
  ctx.restore();
}

// ---------------------------------------------------------------- picking and outlines

/** How far a generator reaches either side of its track, in band widths. */
export function generatorReach(layer: GrowthLayer | KnotworkLayer | GearsLayer | ChainLayer): number {
  switch (layer.type) {
    case 'growth':
      return layer.kind === 'antlers' ? layer.branchLength : layer.amplitude + layer.thickness + (layer.branching > 0 ? layer.branchLength * 0.7 : 0) + (layer.extra !== 'none' ? layer.extraSize * 0.6 : 0);
    case 'knotwork':
      return layer.amplitude + layer.width / 2 + layer.outlineWidth;
    case 'gears':
      return (layer.size * Math.max(1, layer.altSize)) / 2;
    case 'chain':
      return (layer.linkLength * layer.linkWidth) / 2;
  }
}

/** Distance from a point to a track, in pixels. */
export function distanceToTrack(t: Track, pt: Point): number {
  let best = Infinity;
  const n = t.closed ? t.points.length : t.points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = t.points[i];
    const b = t.points[(i + 1) % t.points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const k = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + dx * k - pt.x, a.y + dy * k - pt.y));
  }
  return best;
}

