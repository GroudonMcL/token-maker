// Tracks (DESIGN.md §4.9): the outlines ornaments and text follow. The band
// at an across position is one closed track; a path layer is one track per
// copy (mirrored and radial copies included), open or closed; a line layer
// is its own outline, wavy or not. Positions along a track are measured in
// pixels along it, so elements are spaced evenly whatever its shape.

import type { FrameGeometry } from '../../render/frameKit';
import { perimeterLength } from '../../render/frameKit';
import type { PerimeterSample, Point } from '../../render/shapes';
import type { Layer, LineLayer, WaveShape } from '../project/types';
import { bandWidthPx, outlineAt, spacedAlong } from './band';
import { flattenPath } from './facets';
import { placements, toCanvas } from './placed';

/** Finds a layer anywhere in the project by id (for the layers others follow). */
export type FindLayer = (id: string) => Layer | undefined;
export const findNothing: FindLayer = () => undefined;

export interface Track {
  points: Point[];
  closed: boolean;
}

/** One wave of each shape (version 10), for t from 0 to 1 a wave: -1 (outwards) to 1 (inwards). */
const WAVE: Record<WaveShape, (t: number) => number> = {
  sine: (t) => Math.sin(Math.PI * 2 * t),
  zigzag: (t) => (2 / Math.PI) * Math.asin(Math.sin(Math.PI * 2 * t)),
  // Arches bulging outwards, meeting in points on the inside.
  scallop: (t) => 1 - 2 * Math.abs(Math.sin(Math.PI * t)),
  // Battlements: a smoothed square wave.
  square: (t) => Math.max(-1, Math.min(1, Math.sin(Math.PI * 2 * t) * 6)),
};

/** The outline a line follows: the band's outline at its position, wobbling in and out if it is wavy. */
export function lineOutline(layer: LineLayer, g: FrameGeometry): Point[] {
  const outline = outlineAt(g, layer.at);
  if (layer.waveAmplitude <= 0 || outline.length === 0) return outline;
  const waves = lineWaves(layer, outline, g);
  const shape = layer.waveShape ?? 'sine';
  const n = Math.max(240, waves * (shape === 'sine' ? 24 : 48));
  const amp = layer.waveAmplitude * bandWidthPx(g);
  const wave = WAVE[shape] ?? WAVE.sine;
  return spacedAlong(outline, n).map((p, i) => {
    const off = amp * wave(waves * (i / n) + layer.wavePhase);
    // Inwards is to the right of the direction of travel (outlines run clockwise).
    return { x: p.x - Math.sin(p.angle) * off, y: p.y + Math.cos(p.angle) * off };
  });
}

/** How many waves a wavy line has: its own number, or as many as fit at `waveFit` band widths each (at least 2). */
export function lineWaves(layer: Pick<LineLayer, 'waves' | 'waveFit'>, outline: Point[], g: FrameGeometry): number {
  return layer.waveFit > 0 ? Math.max(2, Math.round(perimeterLength(outline) / Math.max(1, layer.waveFit * bandWidthPx(g)))) : layer.waves;
}

/** How many of something fit round a track at `spacing` pixels each (at least `min`). */
export function fitCount(t: Track, spacing: number, min = 1): number {
  return Math.max(min, Math.round(trackLength(t) / Math.max(1, spacing)));
}

/** The layer `follow` names, if it is one that can be followed. */
export function followed(follow: string | null, find: FindLayer): Extract<Layer, { type: 'path' | 'line' }> | null {
  if (!follow) return null;
  const l = find(follow);
  return l && (l.type === 'line' || (l.type === 'path' && l.points.length > 1)) ? l : null;
}

/** The tracks of a path or line layer, in pixels. */
export function tracksOf(layer: Extract<Layer, { type: 'path' | 'line' }>, g: FrameGeometry): Track[] {
  if (layer.type === 'line') return [{ points: lineOutline(layer, g), closed: true }];
  return placements(layer, g).map((t) => ({
    points: flattenPath(layer.points, layer.closed, t.ux, t.uy, 16).map((p) => toCanvas(t, { x: p.x / t.ux, y: p.y / t.uy })),
    closed: layer.closed,
  }));
}

/** What a layer with `follow` and an across position runs along: the followed layer's tracks, or the band. */
export function tracksFor(follow: string | null, at: number, g: FrameGeometry, find: FindLayer): Track[] {
  const target = followed(follow, find);
  if (target) return tracksOf(target, g).filter((t) => t.points.length > 1);
  const outline = outlineAt(g, at);
  return outline.length ? [{ points: outline, closed: true }] : [];
}

/** How long a track is, in pixels. */
export function trackLength(t: Track): number {
  if (t.closed) return perimeterLength(t.points);
  let L = 0;
  for (let i = 1; i < t.points.length; i++) L += Math.hypot(t.points[i].x - t.points[i - 1].x, t.points[i].y - t.points[i - 1].y);
  return L;
}

/** The point `d` pixels along a track (wrapping round a closed one), with its direction of travel; null past the ends of an open one. */
export function pointAlong(t: Track, d: number): PerimeterSample | null {
  const L = trackLength(t);
  const pts = t.points;
  if (pts.length < 2 || L <= 0) return null;
  if (t.closed) d = ((d % L) + L) % L;
  else if (d < -1e-6 || d > L + 1e-6) return null;
  const segments = t.closed ? pts.length : pts.length - 1;
  let rest = Math.max(0, d);
  for (let i = 0; i < segments; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (rest <= len || i === segments - 1) {
      const k = len === 0 ? 0 : Math.min(1, rest / len);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    rest -= len;
  }
  return null;
}

/** A position on a track and how far along it is (0 at the start, 1 at the end or all the way round). */
export interface TrackSample extends PerimeterSample {
  t: number;
}

/**
 * `count` points evenly spaced along a track, slid `offset` of a gap along.
 * Closed: evenly all the way round (as the band's spacedAlong). Open: from
 * end to end, both ends included; those slid past the end are left out.
 */
export function spacedOnTrack(t: Track, count: number, offset = 0): (TrackSample | null)[] {
  if (count <= 0) return [];
  if (t.closed) return spacedAlong(t.points, count, offset).map((p, i) => ({ ...p, t: (((i + offset) / count) % 1 + 1) % 1 }));
  const L = trackLength(t);
  const gap = count > 1 ? L / (count - 1) : 0;
  return Array.from({ length: count }, (_v, i) => {
    const d = count > 1 ? (i + offset) * gap : L / 2;
    const p = pointAlong(t, d);
    return p ? { ...p, t: L > 0 ? d / L : 0 } : null;
  });
}
