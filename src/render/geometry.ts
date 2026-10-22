// Crop maths (ported from the extension): where the art sits inside the
// frame, how far it may move and how small it may get before an empty corner
// would show. Lengths are fractions of the token's half-size R.

import { DEFAULT_TRANSFORM } from '../document/defaults';
import { computeInsets } from '../document/sizing';
import type { ArtTransform, TokenDocument } from '../document/types';
import { nudgedHole } from '../image/frameHole';
import { boundingBox, shapePolygon, type Point } from './shapes';

export const ZOOM_MAX = 8;
export const ZOOM_MIN = 0.05;

/** The polygon the art is clipped to, for a token of half-size 1: the frame's opening, or a picture frame's hole. */
export function imageClipPolygon(doc: Pick<TokenDocument, 'shape' | 'frame' | 'size'>): Point[] {
  const img = doc.frame.kind === 'image' ? doc.frame.image : null;
  if (img) return nudgedHole(img.hole, img.nudge);
  return shapePolygon(doc.shape, 1, computeInsets(doc).image);
}

/** Scale (image px → R units) at which the image exactly covers the clip region's bounding box. */
export function baseScale(imageWidth: number, imageHeight: number, clip: Point[]): number {
  const box = boundingBox(clip);
  return Math.max((box.maxX - box.minX) / imageWidth, (box.maxY - box.minY) / imageHeight);
}

export function rotatePoint(p: Point, radians: number): Point {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Clip polygon in the image's rotated frame (rotated by -θ). */
function rotatedExtents(clip: Point[], rotationDeg: number) {
  return boundingBox(clip.map((p) => rotatePoint(p, (-rotationDeg * Math.PI) / 180)));
}

/** The smallest zoom at which the rotated image still covers the clip polygon. */
export function minZoomToCover(imageWidth: number, imageHeight: number, clip: Point[], rotationDeg: number): number {
  const s0 = baseScale(imageWidth, imageHeight, clip);
  const e = rotatedExtents(clip, rotationDeg);
  return Math.max((e.maxX - e.minX) / (imageWidth * s0), (e.maxY - e.minY) / (imageHeight * s0));
}

/** Zoom at which the whole image is visible inside the clip region's bounding box (letterboxed). */
export function fitZoom(imageWidth: number, imageHeight: number, clip: Point[]): number {
  const box = boundingBox(clip);
  const contain = Math.min((box.maxX - box.minX) / imageWidth, (box.maxY - box.minY) / imageHeight);
  return contain / baseScale(imageWidth, imageHeight, clip);
}

/**
 * Pulls zoom and offset back to the nearest values at which the image covers
 * the clip polygon. The polygon lies inside the rotated image rectangle exactly
 * when every vertex does, which in the image's own frame is a box constraint
 * on the centre offset. Flips don't change coverage.
 */
export function clampTransform(t: ArtTransform, imageWidth: number, imageHeight: number, clip: Point[]): ArtTransform {
  const lower = t.lockFill ? minZoomToCover(imageWidth, imageHeight, clip, t.rotation) : ZOOM_MIN;
  const zoom = Math.min(ZOOM_MAX, Math.max(lower, Number.isFinite(t.zoom) ? t.zoom : 1));
  if (!t.lockFill) {
    // Keep at least part of the art near the token so it can't be lost off-screen.
    const limit = 3;
    return {
      ...t,
      zoom,
      offsetX: Math.max(-limit, Math.min(limit, t.offsetX)),
      offsetY: Math.max(-limit, Math.min(limit, t.offsetY)),
    };
  }

  const theta = (t.rotation * Math.PI) / 180;
  const s = baseScale(imageWidth, imageHeight, clip) * zoom;
  const halfW = (imageWidth * s) / 2;
  const halfH = (imageHeight * s) / 2;
  const e = rotatedExtents(clip, t.rotation);
  const u = rotatePoint({ x: t.offsetX, y: t.offsetY }, -theta);
  const clampAxis = (value: number, max: number, min: number, half: number) => {
    const lo = max - half;
    const hi = min + half;
    return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, value));
  };
  const clamped = rotatePoint({ x: clampAxis(u.x, e.maxX, e.minX, halfW), y: clampAxis(u.y, e.maxY, e.minY, halfH) }, theta);
  return { ...t, zoom, offsetX: clamped.x, offsetY: clamped.y };
}

/** Zooms by `factor` keeping the image point under `anchor` (R units from centre) fixed. */
export function zoomAround(t: ArtTransform, factor: number, anchor: Point): ArtTransform {
  const zoom = t.zoom * factor;
  const ratio = zoom / t.zoom;
  return {
    ...t,
    zoom,
    offsetX: anchor.x - (anchor.x - t.offsetX) * ratio,
    offsetY: anchor.y - (anchor.y - t.offsetY) * ratio,
  };
}

/** Rotates by `deg` degrees around `anchor` (R units from centre). */
export function rotateAround(t: ArtTransform, deg: number, anchor: Point): ArtTransform {
  const rel = rotatePoint({ x: t.offsetX - anchor.x, y: t.offsetY - anchor.y }, (deg * Math.PI) / 180);
  return { ...t, rotation: normaliseAngle(t.rotation + deg), offsetX: anchor.x + rel.x, offsetY: anchor.y + rel.y };
}

/** An angle in degrees, folded into -180…180. */
export function normaliseAngle(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Zooms just enough to cover the frame (clamped as if locked, but leaves the art free to move afterwards). */
export function fillTransform(t: ArtTransform, w: number, h: number, clip: Point[]): ArtTransform {
  const filled = clampTransform({ ...t, lockFill: true, zoom: minZoomToCover(w, h, clip, t.rotation) }, w, h, clip);
  return { ...filled, lockFill: t.lockFill };
}

export function fitTransform(t: ArtTransform, w: number, h: number, clip: Point[]): ArtTransform {
  return { ...t, lockFill: false, rotation: 0, zoom: fitZoom(w, h, clip), offsetX: 0, offsetY: 0 };
}

export function resetTransform(w: number, h: number, clip: Point[]): ArtTransform {
  return clampTransform({ ...DEFAULT_TRANSFORM }, w, h, clip);
}

/** Initial framing: fill the frame and bias portrait art upwards, where faces usually are. */
export function initialTransform(w: number, h: number, clip: Point[]): ArtTransform {
  const base = resetTransform(w, h, clip);
  if (h <= w * 1.15) return base;
  const topAligned = clampTransform({ ...base, lockFill: true, offsetY: 10 }, w, h, clip);
  return { ...base, offsetY: topAligned.offsetY * 0.6 };
}

/** The art's four corners in R units from the token centre (for on-canvas handles). */
export function artCorners(t: ArtTransform, w: number, h: number, clip: Point[]): Point[] {
  const s = baseScale(w, h, clip) * t.zoom;
  const theta = (t.rotation * Math.PI) / 180;
  return [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ].map((p) => {
    const r = rotatePoint({ x: p.x * s, y: p.y * s }, theta);
    return { x: r.x + t.offsetX, y: r.y + t.offsetY };
  });
}

/**
 * The inverse of how the art is drawn: a point in token units (R = 1, from
 * the token centre) → the same spot on the picture, as 0–1 across its width
 * and height. Values outside 0–1 are off the picture.
 */
export function imagePointAt(t: ArtTransform, w: number, h: number, clip: Point[], p: Point): Point {
  const s = baseScale(w, h, clip) * t.zoom;
  const r = rotatePoint({ x: p.x - t.offsetX, y: p.y - t.offsetY }, (-t.rotation * Math.PI) / 180);
  const x = (r.x / s) * (t.flipX ? -1 : 1);
  const y = (r.y / s) * (t.flipY ? -1 : 1);
  return { x: (x + w / 2) / w, y: (y + h / 2) / h };
}

/** Where a spot on the picture (0–1 across its width and height) is drawn, in token units: the reverse of imagePointAt. */
export function tokenPointAt(t: ArtTransform, w: number, h: number, clip: Point[], q: Point): Point {
  const s = baseScale(w, h, clip) * t.zoom;
  const x = (q.x * w - w / 2) * s * (t.flipX ? -1 : 1);
  const y = (q.y * h - h / 2) * s * (t.flipY ? -1 : 1);
  const r = rotatePoint({ x, y }, (t.rotation * Math.PI) / 180);
  return { x: r.x + t.offsetX, y: r.y + t.offsetY };
}
