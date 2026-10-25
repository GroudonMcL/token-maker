// One painter per layer type. Each draws its layer onto a context whose origin
// is the token's centre. New layer types are added here and in
// project/types.ts; the editor finds their controls in ui/PropertiesPanel.tsx.
// Groups and clipping are handled by renderProject.

import { rgba } from '../../render/color';
import { atPoint, noShadow, seededRandom, tracePolygon, type FrameGeometry } from '../../render/frameKit';
import { drawFrame } from '../../render/frames';
import type { PerimeterSample } from '../../render/shapes';
import { lineLayer } from '../project/defaults';
import type { ContoursLayer, Layer, LegacyFrameLayer, LineLayer, Paint, RepeatLayer } from '../project/types';
import { bandWidthPx, repeatCount } from './band';
import { centredCanvas, context2d, newCanvas, putCentred, type Ctx } from './canvas';
import { activeEffects, applyEffects } from './effects';
import { drawElement, drawSetting, gemOutline, runeFor, type GemStyle } from './elements';
import { drawText } from './text';
import { drawCells, drawChain, drawFracture, drawGears, drawGrowth, drawKnotwork } from './generators';
import { findNothing, followed, lineOutline, spacedOnTrack, trackLength, tracksFor, type FindLayer } from './track';
import { lightAt, raisedFrom } from './light';
import { fillBand, paintCanvas, paintStyle, recolourRound, ringTableFor } from './paint';
import { drawPlaced } from './placed';
import { drawTexture } from './textures';

/** What every painter needs besides its layer. */
export interface RenderEnv {
  g: FrameGeometry;
  /** The stage's light direction, in degrees. */
  light: number;
  /** The square's size in pixels. */
  size: number;
  /** Finds the layers others follow (version 6). */
  find?: FindLayer;
}

function drawLegacy(ctx: Ctx, layer: LegacyFrameLayer, g: FrameGeometry): void {
  // Exactly what token-maker's renderer passes to drawFrame (its render.ts, layer 9).
  drawFrame(ctx, layer.style, { ...g, color: layer.color, accent: layer.accent ?? undefined });
}

export { lineOutline } from './track';

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
    if (layer.raised) raisedFrom(ctx, bandWidthPx(g), env.light);
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
  if (layer.raised) raisedFrom(ctx, bandWidthPx(g), env.light);
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
  /** Its number before any were left out (picks the rune, note or rough crystal). */
  index: number;
  /** Extra turn from random variation, in radians. */
  spin: number;
  /** A random number (0–1) for elements that come in kinds (Bard's notes), or undefined. */
  variant?: number;
}

/** How far element i is from the nearest bigger one, counting round the ring. */
function stepsFromAccent(i: number, n: number, every: number): number {
  const back = i % every;
  const next = i + (every - back);
  return Math.min(back, next < n ? next - i : n - i);
}

/**
 * Where each element of a repeat goes, for drawing and for picking on the
 * canvas: round the band, or along every track of the layer it follows
 * (DESIGN.md §4.9), with its patterns and random variation.
 */
export function repeatPlacements(layer: RepeatLayer, g: FrameGeometry, find: FindLayer = findNothing): RepeatPlacement[] {
  const tracks = tracksFor(layer.follow, layer.at, g, find);
  const onBand = !followed(layer.follow, find);
  const w = bandWidthPx(g);
  const h = layer.size * w;
  const colors = [layer.fill, ...layer.altColors];
  const varies = layer.jitterSize > 0 || layer.jitterAngle > 0 || layer.skipChance > 0;
  const random = seededRandom(layer.seed * 4099 + 0x51f7);
  // Wandering in and out and Bard's kinds of note come from the seed itself, in Token Maker's order (version 10).
  const tokenMaker = seededRandom(layer.seed);
  const kinds = layer.element === 'bardNote';
  const out: RepeatPlacement[] = [];
  let first = 0;
  for (const track of tracks) {
    const n = onBand
      ? repeatCount(g, layer.at, layer.mode, layer.count, layer.spacing, layer.snapToCorners, layer.multipleOf)
      : layer.mode === 'count'
        ? layer.count
        : Math.max(1, Math.round(trackLength(track) / Math.max(1, layer.spacing * w)) + (track.closed ? 0 : 1));
    spacedOnTrack(track, n, layer.offset).forEach((p, k) => {
      const i = first + k;
      // Three numbers per element, whether or not it is drawn, so one setting doesn't reshuffle the others.
      const [rs, ra, rk] = varies ? [random(), random(), random()] : [0.5, 0.5, 1];
      const across = layer.wander > 0 ? (tokenMaker() - 0.5) * layer.wander : 0;
      const variant = kinds ? tokenMaker() : undefined;
      if (!p) return;
      if (layer.show.length && !layer.show[i % layer.show.length]) return;
      if (rk < layer.skipChance) return;
      const accent = layer.accentEvery > 0 && i % layer.accentEvery === 0;
      if (!accent && layer.accentEvery > 0 && layer.skipAroundAccent > 0 && stepsFromAccent(k, n, layer.accentEvery) <= layer.skipAroundAccent) return;
      const along = layer.scaleEnd === 1 ? 1 : 1 + (layer.scaleEnd - 1) * p.t;
      const size = h * (layer.altSizes.length ? layer.altSizes[i % layer.altSizes.length] : 1) * (accent ? layer.accentScale : 1) * along * (1 + layer.jitterSize * (rs - 0.5) * 2);
      const flip = layer.alternateSides > 0 && i % 2 === 1;
      let at: PerimeterSample = { x: p.x, y: p.y, angle: p.angle };
      const off = (layer.alternateSides > 0 ? (flip ? 1 : -1) * layer.alternateSides * w : 0) + across * w;
      if (off !== 0) at = { ...at, x: p.x - Math.sin(p.angle) * off, y: p.y + Math.cos(p.angle) * off };
      if (layer.orient === 'upright') at = { ...at, angle: 0 };
      const color = accent && layer.accentColor ? layer.accentColor : colors[i % colors.length];
      out.push({ p: at, h: size, accent, color, flip, index: i, spin: ((layer.jitterAngle * (ra - 0.5) * 2) * Math.PI) / 180, variant });
    });
    first += n;
  }
  return out;
}

const OVAL = (w: number, h: number) => Array.from({ length: 32 }, (_v, i) => ({ x: (Math.cos((i * Math.PI) / 16) * w) / 2, y: (Math.sin((i * Math.PI) / 16) * h) / 2 }));

/** The elements of a repeat, or (with `part`) only the back or front of their settings. */
function drawRepeat(ctx: Ctx, layer: RepeatLayer, env: RenderEnv, part: 'elements' | 'back' | 'front' = 'elements'): void {
  const { g } = env;
  const placements = repeatPlacements(layer, g, env.find);
  const variants = runeFor(layer.seed, placements.at(-1) ? placements.at(-1)!.index + 1 : 0);
  const w = bandWidthPx(g);
  const turnBy = (layer.rotation * Math.PI) / 180;
  const paint = layer.fillPaint && part === 'elements' ? { canvas: paintCanvas(layer.fillPaint, g, env.light, env.size), each: layer.paintEach } : null;
  ctx.save();
  if (layer.raised && part !== 'front') raisedFrom(ctx, w, env.light);
  if (layer.glow && part === 'elements') {
    ctx.shadowColor = rgba(layer.glow, 1);
    ctx.shadowBlur = w * 0.5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  for (const { p, h, color, flip, index, spin, variant } of placements) {
    const t = turnBy + spin;
    const l = lightAt(p, env.light);
    // The light turned back by the element's own rotation, and flipped with it.
    const light = { x: l.x * Math.cos(-t) - l.y * Math.sin(-t), y: (l.x * Math.sin(-t) + l.y * Math.cos(-t)) * (flip ? -1 : 1) };
    const gem: GemStyle | undefined =
      layer.element === 'gem' ? { cut: layer.gemCut, table: layer.gemTable, crown: layer.gemCrown, facets: layer.gemFacets, sparkle: layer.gemSparkle, seed: layer.seed * 131 + index } : undefined;
    atPoint(ctx, p, () => {
      ctx.rotate(t);
      if (flip) ctx.scale(1, -1);
      if (part !== 'elements') {
        const ew = h * layer.stretch;
        drawSetting(ctx, layer.setting, part, gem ? gemOutline(gem, ew, h) : OVAL(ew, h), ew, h, layer.settingColor, light);
        return;
      }
      drawElement(ctx, layer.element, h, layer.stretch, {
        fill: color,
        outline: layer.outline,
        outlineWidth: layer.outlineWidth,
        rune: variants[index],
        light,
        shaded: layer.shaded,
        gem,
        detail: layer.detail,
        variant,
        paint,
      });
    });
  }
  noShadow(ctx);
  ctx.restore();
}

/** A repeat with a setting: the back of the settings, the elements, then the front, each part of the setting with its own effects. */
function drawSetRepeat(ctx: Ctx, layer: RepeatLayer, env: RenderEnv): void {
  const part = (which: 'back' | 'front') => {
    const own = centredCanvas(env.size);
    drawRepeat(own.ctx, layer, env, which);
    if (activeEffects(layer.settingEffects).length) {
      own.ctx.save();
      own.ctx.setTransform(1, 0, 0, 1, 0, 0);
      applyEffects(own.ctx, env.size, layer.settingEffects, { bw: bandWidthPx(env.g), light: env.light });
      own.ctx.restore();
    }
    putCentred(ctx, own.canvas, env.size);
  };
  part('back');
  drawRepeat(ctx, layer, env);
  part('front');
}

/** Several lines round the band at once, each thinner (or thicker) than the one before. */
export function contourLines(layer: ContoursLayer): LineLayer[] {
  return Array.from({ length: layer.count }, (_v, i) => {
    const k = layer.count > 1 ? i / (layer.count - 1) : 0;
    const paint: Paint = layer.altColor && i % 2 === 1 && (layer.paint.kind === 'solid' || layer.paint.kind === 'lit') ? { ...layer.paint, color: layer.altColor } : layer.paint;
    return {
      ...lineLayer(),
      at: layer.from + i * layer.spacing,
      width: Math.max(0.001, layer.width * (1 - layer.taper * k)),
      paint,
      dash: layer.dash,
    };
  });
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
      return layer.setting === 'none' ? drawRepeat(ctx, layer, env) : drawSetRepeat(ctx, layer, env);
    case 'text':
      return drawText(ctx, layer, env.g, env.light, env.find);
    case 'contours':
      for (const line of contourLines(layer)) drawLine(ctx, line, env);
      return;
    case 'growth':
      return drawGrowth(ctx, layer, env.g, env.light, env.find);
    case 'fracture':
      return drawFracture(ctx, layer, env.g);
    case 'cells':
      return drawCells(ctx, layer, env.g);
    case 'knotwork':
      return drawKnotwork(ctx, layer, env.g, env.find);
    case 'gears':
      return drawGears(ctx, layer, env.g, env.light, env.find);
    case 'chain':
      return drawChain(ctx, layer, env.g, env.light, env.find);
    case 'texture':
      return drawTexture(ctx, layer, env.g, env.light, env.size);
    case 'shape':
    case 'path':
      return drawPlaced(ctx, layer, env.g, env.light, env.size);
    case 'group':
    case 'unsupported':
      return;
  }
}
