// Turning pointer movement on the canvas into erase/restore strokes,
// pop-out strokes and eyedropper picks, in the picture's own coordinates
// (DESIGN.md §6.2, §6.6).

import type { ArtTransform } from '../document/types';
import type { AnyStroke } from '../image/strokes';
import { toHex } from '../render/color';
import { baseScale, imagePointAt } from '../render/geometry';
import type { Point } from '../render/shapes';
import type { PixelBuffer } from '../image/adjust';

/** Rounds stored numbers so saved documents stay small. */
const round = (v: number) => Math.round(v * 10000) / 10000;

export interface StrokeContext {
  transform: ArtTransform;
  width: number;
  height: number;
  clip: Point[];
  /** Screen pixels per token unit (the token's on-screen radius). */
  R: number;
}

/** Screen pixels per picture pixel at the current zoom. */
export const screenScale = (c: StrokeContext) => baseScale(c.width, c.height, c.clip) * c.transform.zoom * c.R;

/** A new stroke starting at `p` (token units), with the brush size given in screen pixels. */
export function startStroke<S extends AnyStroke>(
  c: StrokeContext,
  p: Point,
  pressure: number,
  brush: { mode: S['mode']; sizePx: number; softness: number },
): S {
  const q = imagePointAt(c.transform, c.width, c.height, c.clip, p);
  return {
    mode: brush.mode,
    size: round(brush.sizePx / screenScale(c) / Math.max(c.width, c.height)),
    softness: round(brush.softness / 100),
    points: [round(q.x), round(q.y), round(pressure)],
  } as S;
}

/**
 * The stroke with one more point, or the same stroke if the pointer has
 * moved less than about a pixel on screen (keeps documents small).
 */
export function extendStroke<S extends AnyStroke>(c: StrokeContext, s: S, p: Point, pressure: number): S {
  const q = imagePointAt(c.transform, c.width, c.height, c.clip, p);
  const n = s.points.length;
  const lastX = s.points[n - 3]!;
  const lastY = s.points[n - 2]!;
  const moved = Math.hypot((q.x - lastX) * c.width, (q.y - lastY) * c.height) * screenScale(c);
  if (moved < 1.5) return s;
  return { ...s, points: [...s.points, round(q.x), round(q.y), round(pressure)] };
}

/** Pen pressure, or full pressure for mouse and touch (a mouse reports 0.5 while pressed). */
export function pointerPressure(e: { pointerType: string; pressure: number }, usePressure: boolean): number {
  return usePressure && e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 1;
}

/** The average colour around a point (0–1 coordinates) of a picture, as #rrggbb; null if off the picture. */
export function pickColour(pixels: PixelBuffer, x: number, y: number): string | null {
  const { data, width: w, height: h } = pixels;
  const cx = Math.floor(x * w);
  const cy = Math.floor(y * h);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let yy = Math.max(0, cy - 1); yy <= Math.min(h - 1, cy + 1); yy++) {
    for (let xx = Math.max(0, cx - 1); xx <= Math.min(w - 1, cx + 1); xx++) {
      const i = (yy * w + xx) * 4;
      if (data[i + 3]! < 128) continue;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  return n ? toHex({ r: r / n, g: g / n, b: b / n }) : null;
}
