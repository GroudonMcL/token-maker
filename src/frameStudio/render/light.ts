// The light direction (DESIGN.md §9, owner's answer 1). Everything Frame
// Studio lights itself follows stage.light; at 225° (the top left) every
// result is exactly what token-maker's fixed light gives, so version-1
// designs draw the same.

import { localLight, raised } from '../../render/frameKit';
import type { PerimeterSample, Point } from '../../render/shapes';
import { DEFAULT_LIGHT } from '../project/types';
import type { Ctx } from './canvas';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** A unit vector pointing towards the light. */
export function lightVector(light: number): Point {
  if (light === DEFAULT_LIGHT) return { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
  return { x: Math.cos(rad(light)), y: Math.sin(rad(light)) };
}

/** The light in the local frame of a point on the band (+x along, +y inwards), like the engine's localLight. */
export function lightAt(p: PerimeterSample, light: number): Point {
  if (light === DEFAULT_LIGHT) return localLight(p);
  return turn(lightVector(light), -p.angle);
}

/** A vector turned by `angle` radians (clockwise on screen). */
export function turn(v: Point, angle: number): Point {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** The engine's raised shadow, falling away from the light. */
export function raisedFrom(ctx: Ctx, w: number, light: number, alpha?: number): void {
  raised(ctx, w, alpha);
  if (light === DEFAULT_LIGHT) return;
  // The engine's offset (down and right) turned with the light.
  const off = turn({ x: w * 0.05, y: w * 0.08 }, rad(light - DEFAULT_LIGHT));
  ctx.shadowOffsetX = off.x;
  ctx.shadowOffsetY = off.y;
}

const rotated = new Map<string, string[]>();

/**
 * A 360-entry colour table made for the top-left light (the engine's
 * litTables), turned so its lit side faces `light`.
 */
export function turnTable(table: string[], light: number): string[] {
  const shift = Math.round(light - DEFAULT_LIGHT);
  if (((shift % 360) + 360) % 360 === 0) return table;
  const key = `${shift}|${table[0]}|${table[90]}|${table[180]}|${table[270]}`;
  let out = rotated.get(key);
  if (!out) {
    out = table.map((_c, d) => table[(((d - shift) % 360) + 360) % 360]);
    if (rotated.size > 128) rotated.clear();
    rotated.set(key, out);
  }
  return out;
}
