// One painter per layer type. Each draws its layer onto a context whose origin
// is the token's centre. New layer types are added here and in
// project/types.ts; the editor finds their controls in ui/PropertiesPanel.tsx.
// Groups and clipping are handled by renderProject.

import { rgba } from '../../render/color';
import { atPoint, noShadow, tracePolygon, type FrameGeometry } from '../../render/frameKit';
import { drawFrame } from '../../render/frames';
import type { PerimeterSample, Point } from '../../render/shapes';
import type { Layer, LegacyFrameLayer, LineLayer, RepeatLayer } from '../project/types';
import { bandWidthPx, outlineAt, repeatCount, spacedAlong } from './band';
import { context2d, newCanvas, type Ctx } from './canvas';
import { drawElement, runeFor } from './elements';
import { lightAt, raisedFrom } from './light';
import { fillBand, paintStyle, recolourRound, ringTableFor } from './paint';
import { drawPlaced } from './placed';
import { drawTexture } from './textures';

/** What every painter needs besides its layer. */
export interface RenderEnv {
  g: FrameGeometry;
  /** The stage's light direction, in degrees. */
  light: number;
  /** The square's size in pixels. */
  size: number;
}

function drawLegacy(ctx: Ctx, layer: LegacyFrameLayer, g: FrameGeometry): void {
  // Exactly what token-maker's renderer passes to drawFrame (its render.ts, layer 9).
  drawFrame(ctx, layer.style, { ...g, color: layer.color, accent: layer.accent ?? undefined });
}

/** The outline a line follows: the band's outline at its position, wobbling in and out if it is wavy. */
export function lineOutline(layer: LineLayer, g: FrameGeometry): Point[] {
  const outline = outlineAt(g, layer.at);
  if (layer.waveAmplitude <= 0 || outline.length === 0) return outline;
  const n = Math.max(240, layer.waves * 24);
  const amp = layer.waveAmplitude * bandWidthPx(g);
  return spacedAlong(outline, n).map((p, i) => {
    const off = amp * Math.sin(Math.PI * 2 * (layer.waves * (i / n) + layer.wavePhase));
    // Inwards is to the right of the direction of travel (outlines run clockwise).
    return { x: p.x - Math.sin(p.angle) * off, y: p.y + Math.cos(p.angle) * off };
  });
}

function drawLine(ctx: Ctx, layer: LineLayer, env: RenderEnv): void {
  const { g } = env;
  const outline = lineOutline(layer, g);
  const width = layer.width * bandWidthPx(g);
  if (outline.length === 0 || width <= 0) return;
  ctx.save();
  tracePolygon(ctx, outline);
  ctx.lineWidth = width;
  ctx.lineJoin = g.shape === 'circle' || g.shape === 'rounded' || layer.waveAmplitude > 0 ? 'round' : 'miter';
  ctx.miterLimit = 4;
  if (layer.dash === 'dashed') ctx.setLineDash([width * 3, width * 2]);
  if (layer.dash === 'dotted') {
    ctx.setLineDash([0.001, width * 2]);
    ctx.lineCap = 'round';
  }
  if (layer.paint.kind === 'ring') {
    // Stroked on its own canvas, recoloured round the ring, then put down (with its glow).
    const own = newCanvas(env.size, env.size);
    const octx = context2d(own);
    octx.translate(env.size / 2, env.size / 2);
    octx.lineWidth = ctx.lineWidth;
    octx.lineJoin = ctx.lineJoin;
    octx.lineCap = ctx.lineCap;
    octx.miterLimit = ctx.miterLimit;
    octx.setLineDash(ctx.getLineDash());
    tracePolygon(octx, outline);
    octx.strokeStyle = '#000000';
    octx.stroke();
    recolourRound(octx, g.R, ringTableFor(layer.paint, env.light));
    if (layer.glow) {
      ctx.shadowColor = rgba(layer.glow, 1);
      ctx.shadowBlur = bandWidthPx(g) * 0.5;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(own as CanvasImageSource, 0, 0);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = paintStyle(ctx, g, layer.paint, layer.at, layer.at, env.light);
  if (layer.glow) {
    ctx.shadowColor = rgba(layer.glow, 1);
    ctx.shadowBlur = bandWidthPx(g) * 0.5;
  }
  ctx.stroke();
  ctx.restore();
}

export interface RepeatPlacement {
  p: PerimeterSample;
  /** Height in pixels. */
  h: number;
  accent: boolean;
  color: string;
  /** Points the other way (alternate sides). */
  flip: boolean;
  /** Its number round the ring before any were left out (picks the rune or note). */
  index: number;
}

/** How far element i is from the nearest bigger one, counting round the ring. */
function stepsFromAccent(i: number, n: number, every: number): number {
  const back = i % every;
  const next = i + (every - back);
  return Math.min(back, next < n ? next - i : n - i);
}

/** Where each element of a repeat goes, for drawing and for picking on the canvas. */
export function repeatPlacements(layer: RepeatLayer, g: FrameGeometry): RepeatPlacement[] {
  const n = repeatCount(g, layer.at, layer.mode, layer.count, layer.spacing, layer.snapToCorners);
  const points = spacedAlong(outlineAt(g, layer.at), n, layer.offset);
  const w = bandWidthPx(g);
  const h = layer.size * w;
  const colors = [layer.fill, ...layer.altColors];
  const out: RepeatPlacement[] = [];
  points.forEach((p, i) => {
    if (layer.show.length && !layer.show[i % layer.show.length]) return;
    const accent = layer.accentEvery > 0 && i % layer.accentEvery === 0;
    if (!accent && layer.accentEvery > 0 && layer.skipAroundAccent > 0 && stepsFromAccent(i, n, layer.accentEvery) <= layer.skipAroundAccent) return;
    const size = h * (layer.altSizes.length ? layer.altSizes[i % layer.altSizes.length] : 1) * (accent ? layer.accentScale : 1);
    const flip = layer.alternateSides > 0 && i % 2 === 1;
    let at = p;
    if (layer.alternateSides > 0) {
      const off = (flip ? 1 : -1) * layer.alternateSides * w;
      at = { ...p, x: p.x - Math.sin(p.angle) * off, y: p.y + Math.cos(p.angle) * off };
    }
    const color = accent && layer.accentColor ? layer.accentColor : colors[i % colors.length];
    out.push({ p: at, h: size, accent, color, flip, index: i });
  });
  return out;
}

function drawRepeat(ctx: Ctx, layer: RepeatLayer, env: RenderEnv): void {
  const { g } = env;
  const placements = repeatPlacements(layer, g);
  const variants = runeFor(layer.seed, placements.at(-1) ? placements.at(-1)!.index + 1 : 0);
  const w = bandWidthPx(g);
  const turn = (layer.rotation * Math.PI) / 180;
  ctx.save();
  if (layer.raised) raisedFrom(ctx, w, env.light);
  if (layer.glow) {
    ctx.shadowColor = rgba(layer.glow, 1);
    ctx.shadowBlur = w * 0.5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  for (const { p, h, color, flip, index } of placements) {
    const l = lightAt(p, env.light);
    // The light turned back by the element's own rotation, and flipped with it.
    const light = { x: l.x * Math.cos(-turn) - l.y * Math.sin(-turn), y: (l.x * Math.sin(-turn) + l.y * Math.cos(-turn)) * (flip ? -1 : 1) };
    atPoint(ctx, p, () => {
      ctx.rotate(turn);
      if (flip) ctx.scale(1, -1);
      drawElement(ctx, layer.element, h, layer.stretch, {
        fill: color,
        outline: layer.outline,
        outlineWidth: layer.outlineWidth,
        rune: variants[index],
        light,
        shaded: layer.shaded,
      });
    });
  }
  noShadow(ctx);
  ctx.restore();
}

/** Draws one layer that isn't a group (groups are drawn by renderProject). */
export function drawLayer(ctx: Ctx, layer: Layer, env: RenderEnv): void {
  switch (layer.type) {
    case 'legacyFrame':
      return drawLegacy(ctx, layer, env.g);
    case 'bandFill':
      return fillBand(ctx, env.g, layer.from, layer.to, layer.paint, env.light);
    case 'line':
      return drawLine(ctx, layer, env);
    case 'repeat':
      return drawRepeat(ctx, layer, env);
    case 'texture':
      return drawTexture(ctx, layer, env.g, env.light, env.size);
    case 'shape':
    case 'path':
      return drawPlaced(ctx, layer, env.g, env.light);
    case 'group':
    case 'unsupported':
      return;
  }
}
