// Turning a Paint (project/types.ts) into canvas colours.

import { angularFill, clipToBand, litTables, type FrameGeometry, type LitTables } from '../../render/frameKit';
import { mix, rgba } from '../../render/color';
import { shapePolygon } from '../../render/shapes';
import { pictureById } from '../project/pictures';
import { DEFAULT_LIGHT, type GradientStop, type Paint, type RingStop } from '../project/types';
import { bandWidthPx, insetAt, spacedAlong } from './band';
import { context2d, newCanvas, type CanvasLike, type Ctx } from './canvas';
import { lightVector, turn, turnTable } from './light';
import { pictureImage, type PicturePaint } from './pictures';

const litCache = new Map<string, LitTables>();

/** token-maker's lighting tables for a colour (cached, they take 360 colour mixes). `highlight` null = the engine's default. */
export function litFor(color: string, light: number, dark: number, highlight: string | null = null): LitTables {
  const key = `${color}|${light}|${dark}|${highlight ?? ''}`;
  let t = litCache.get(key);
  if (!t) {
    t = litTables(color, { light, dark, highlight: highlight ?? undefined });
    if (litCache.size > 64) litCache.clear();
    litCache.set(key, t);
  }
  return t;
}

/** A stop's colour as the canvas wants it: plain hex when solid, rgba() when see-through (as token-maker writes its rims). */
const stopColor = (s: GradientStop) => (s.opacity >= 1 ? s.color : rgba(s.color, Math.max(0, s.opacity)));

function addStops(gradient: CanvasGradient, stops: GradientStop[]): CanvasGradient {
  for (const s of stops) gradient.addColorStop(Math.min(1, Math.max(0, s.at)), stopColor(s));
  return gradient;
}

const ringCache = new Map<string, string[]>();

/** A 360-entry table (one colour per degree) blending between colour stops round the ring. */
export function ringTable(stops: RingStop[]): string[] {
  const key = JSON.stringify(stops);
  const cached = ringCache.get(key);
  if (cached) return cached;
  const s = [...stops].sort((a, b) => a.angle - b.angle);
  const table: string[] = [];
  for (let d = 0; d < 360; d++) {
    if (s.length === 0) {
      table.push('#000000');
      continue;
    }
    // The stops either side of this angle, going round past 360° if need be.
    let i = -1;
    while (i + 1 < s.length && s[i + 1].angle <= d) i++;
    const prev = i >= 0 ? s[i] : { angle: s[s.length - 1].angle - 360, color: s[s.length - 1].color };
    const next = i >= 0 ? (s[i + 1] ?? { angle: s[0].angle + 360, color: s[0].color }) : s[0];
    const span = next.angle - prev.angle;
    table.push(mix(prev.color, next.color, span > 0 ? (d - prev.angle) / span : 0));
  }
  if (ringCache.size > 64) ringCache.clear();
  ringCache.set(key, table);
  return table;
}

/** The colour table of a ring paint, turned to the light if it follows it. */
export function ringTableFor(paint: Extract<Paint, { kind: 'ring' }>, light: number): string[] {
  const table = ringTable(paint.stops);
  return paint.followLight ? turnTable(table, light) : table;
}

/**
 * Fills everything already drawn on a context with a ring paint, keeping its
 * alpha (for lines, which can't be filled with wedges directly). Thin wedges,
 * as angularFill, each one colour.
 */
export function recolourRound(ctx: Ctx, R: number, table: string[]): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const far = R * 2;
  const n = 240;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2 - 0.004;
    const t1 = ((i + 1) / n) * Math.PI * 2 + 0.004;
    ctx.fillStyle = table[Math.floor(((i + 0.5) / n) * 360)];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(t0) * far, Math.sin(t0) * far);
    ctx.lineTo(Math.cos(t1) * far, Math.sin(t1) * far);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The colour table of a lit paint, turned to the light. */
function litTable(paint: Extract<Paint, { kind: 'lit' }>, light: number): string[] {
  const tables = litFor(paint.color, paint.light, paint.dark, paint.highlight);
  return turnTable(paint.pressed ? tables.step : tables.band, light);
}

/**
 * A fill style for a Paint (lit paints on band fills are drawn as wedges
 * instead, see fillBand). `from`/`to` are the across positions the gradient
 * spans; `light` is the stage's light direction.
 */
export function paintStyle(ctx: Ctx, g: FrameGeometry, paint: Paint, from: number, to: number, light: number): string | CanvasGradient | CanvasPattern {
  switch (paint.kind) {
    case 'picture': {
      const img = pictureImage(paint.picture);
      return img ? picturePattern(ctx, img, paint, tileSize(g, paint)) : standIn(paint);
    }
    case 'solid':
      return paint.color;
    case 'lit': {
      // Lines can't use the wedge fill; a gradient from the lit side to the shaded side stands in.
      const tables = litFor(paint.color, paint.light, paint.dark, paint.highlight);
      const table = paint.pressed ? tables.step : tables.band;
      // Top left to bottom right, turned with the light.
      const s = turn({ x: -g.R * 0.7, y: -g.R * 0.7 }, ((light - DEFAULT_LIGHT) * Math.PI) / 180);
      return addStops(ctx.createLinearGradient(s.x, s.y, -s.x, -s.y), [
        { at: 0, color: table[225], opacity: 1 },
        { at: 1, color: table[45], opacity: 1 },
      ]);
    }
    case 'linear': {
      const a = ((paint.angle + (paint.followLight ? light - DEFAULT_LIGHT : 0)) * Math.PI) / 180;
      const dx = Math.cos(a) * g.R;
      const dy = Math.sin(a) * g.R;
      return addStops(ctx.createLinearGradient(-dx, -dy, dx, dy), paint.stops);
    }
    case 'ring':
      // Lines are recoloured with the wedges instead (recolourRound); this is the colour at the top left.
      return ringTableFor(paint, light)[225];
    case 'acrossBand': {
      // Radial from the token's centre: matches the band exactly on a circle, closely on other shapes.
      const r0 = Math.max(0, g.R - insetAt(g, to));
      const r1 = Math.max(r0 + 0.01, g.R - insetAt(g, from));
      const reversed = paint.stops.map((s) => ({ ...s, at: 1 - s.at })).reverse();
      return addStops(ctx.createRadialGradient(0, 0, r0, 0, 0, r1), reversed);
    }
  }
}

/** Fills the band between two across positions with a paint. */
export function fillBand(ctx: Ctx, g: FrameGeometry, from: number, to: number, paint: Paint, light: number): void {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const outer = Math.max(0, insetAt(g, lo));
  const inner = insetAt(g, hi);
  if (inner <= outer) return;
  if (paint.kind === 'lit') {
    angularFill(ctx, g, outer, inner, litTable(paint, light));
    return;
  }
  if (paint.kind === 'ring') {
    angularFill(ctx, g, outer, inner, ringTableFor(paint, light));
    return;
  }
  if (paint.kind === 'picture') {
    ctx.save();
    clipToBand(ctx, { ...g, outer, inner });
    const img = pictureImage(paint.picture);
    if (img && paint.bend) bentPicture(ctx, g, outer, inner, img, paint);
    else {
      ctx.fillStyle = paintStyle(ctx, g, paint, lo, hi, light);
      ctx.fillRect(-g.R, -g.R, g.R * 2, g.R * 2);
    }
    finishPicture(ctx, g.R, paint, light);
    ctx.restore();
    return;
  }
  ctx.save();
  clipToBand(ctx, { ...g, outer, inner });
  ctx.fillStyle = paintStyle(ctx, g, paint, lo, hi, light);
  ctx.fillRect(-g.R, -g.R, g.R * 2, g.R * 2);
  ctx.restore();
}

// ---- Photo textures (picture paints, version 6) ----

/** A tile's size in pixels: `scale` band widths. */
const tileSize = (g: FrameGeometry, paint: PicturePaint) => Math.max(2, paint.scale * bandWidthPx(g));

/** What is drawn until the picture has loaded: its average colour (or its tint). */
const standIn = (paint: PicturePaint) => paint.tint ?? pictureById(paint.picture)?.average ?? '#808080';

/** The picture as a repeating pattern, `tile` pixels to a tile, turned by the paint's angle. */
function picturePattern(ctx: Ctx, img: CanvasImageSource, paint: PicturePaint, tile: number): CanvasPattern {
  const pattern = ctx.createPattern(img, 'repeat')!;
  const k = tile / ((img as unknown as { width: number }).width || 1);
  const a = (paint.angle * Math.PI) / 180;
  pattern.setTransform({ a: k * Math.cos(a), b: k * Math.sin(a), c: -k * Math.sin(a), d: k * Math.cos(a), e: 0, f: 0 });
  return pattern;
}

/**
 * The picture bent round the band: the band is cut into thin pieces between
 * matching points on its outer and inner edges, and each piece is filled
 * with the pattern turned to run along it, continuing where the last left
 * off. Each piece reaches a little into the next, so no seam shows.
 */
function bentPicture(ctx: Ctx, g: FrameGeometry, outer: number, inner: number, img: CanvasImageSource, paint: PicturePaint): void {
  const w = bandWidthPx(g);
  const outerLine = shapePolygon(g.shape, g.R, outer);
  const innerLine = shapePolygon(g.shape, g.R, inner);
  if (outerLine.length < 2 || innerLine.length < 2) return;
  const n = Math.max(24, Math.round((2 * Math.PI * (g.R - outer)) / Math.max(1, w * 0.3)));
  const a = spacedAlong(outerLine, n);
  const b = spacedAlong(innerLine, n);
  const pattern = picturePattern(ctx, img, paint, tileSize(g, paint));
  const reach = 0.75;
  let along = 0;
  for (let k = 0; k < n; k++) {
    const a0 = a[k];
    const a1 = a[(k + 1) % n];
    const b0 = b[k];
    const b1 = b[(k + 1) % n];
    const len = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1;
    const ux = (a1.x - a0.x) / len;
    const uy = (a1.y - a0.y) / len;
    const blen = Math.hypot(b1.x - b0.x, b1.y - b0.y) || 1;
    const vx = (b1.x - b0.x) / blen;
    const vy = (b1.y - b0.y) / blen;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a0.x - ux * reach, a0.y - uy * reach);
    ctx.lineTo(a1.x + ux * reach, a1.y + uy * reach);
    ctx.lineTo(b1.x + vx * reach, b1.y + vy * reach);
    ctx.lineTo(b0.x - vx * reach, b0.y - vy * reach);
    ctx.closePath();
    ctx.clip();
    ctx.translate(a0.x, a0.y);
    ctx.rotate(Math.atan2(uy, ux));
    ctx.translate(-along, 0);
    ctx.fillStyle = pattern;
    ctx.fillRect(along - w, -w, len + w * 2, w * 3);
    ctx.restore();
    along += (len + blen) / 2;
  }
}

/** A picture's tint (its colours replaced, keeping its light and dark) and lighting, over what has been drawn inside the clip. */
function finishPicture(ctx: Ctx, R: number, paint: PicturePaint, light: number): void {
  if (paint.tint) {
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = paint.tint;
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
  }
  if (paint.lighting > 0) {
    const l = lightVector(light);
    const shine = ctx.createLinearGradient(l.x * R, l.y * R, -l.x * R, -l.y * R);
    shine.addColorStop(0, `rgba(255, 255, 255, ${0.4 * paint.lighting})`);
    shine.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    shine.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    shine.addColorStop(1, `rgba(0, 0, 0, ${0.55 * paint.lighting})`);
    ctx.fillStyle = shine;
    ctx.fillRect(-R, -R, R * 2, R * 2);
  }
}

/** Thin wedges round the centre, each one colour of a 360-entry table, reaching past the square. */
function wedges(ctx: Ctx, R: number, table: string[]): void {
  const far = R * 2;
  const n = 240;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI * 2 - 0.004;
    const t1 = ((i + 1) / n) * Math.PI * 2 + 0.004;
    ctx.fillStyle = table[Math.floor(((i + 0.5) / n) * 360)];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(t0) * far, Math.sin(t0) * far);
    ctx.lineTo(Math.cos(t1) * far, Math.sin(t1) * far);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * A paint over the whole picture (`size` pixels square, origin in the
 * middle), for filling ornaments, shapes and paths with it: colours round
 * the ring and metal lighting by angle, gradients and pictures straight.
 */
export function paintCanvas(paint: Paint, g: FrameGeometry, light: number, size: number): CanvasLike {
  const canvas = newCanvas(size, size);
  const ctx = context2d(canvas);
  ctx.translate(size / 2, size / 2);
  const R = size / 2;
  if (paint.kind === 'lit') wedges(ctx, R, litTable(paint, light));
  else if (paint.kind === 'ring') wedges(ctx, R, ringTableFor(paint, light));
  else {
    ctx.fillStyle = paintStyle(ctx, g, paint, 0, 1, light);
    ctx.fillRect(-R, -R, size, size);
    if (paint.kind === 'picture') finishPicture(ctx, R, paint, light);
  }
  return canvas;
}
