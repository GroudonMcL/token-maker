// The one renderer (DESIGN.md §5): the canvas preview, the template
// thumbnails, the PNG export and the tests all draw through renderProject, so
// what you see is what you export.

import { clipToBand, tracePolygon, type FrameGeometry } from '../../render/frameKit';
import { boundingBox, shapePolygon } from '../../render/shapes';
import type { RenderSource } from '../../render/render';
import type { FrameProject, Layer } from '../project/types';
import { bandGeometry } from './band';
import { context2d, newCanvas, type CanvasLike, type Ctx } from './canvas';
import { bandWidthPx } from './band';
import { activeEffects, applyEffects, heightContribution, lightPass, type EffectEnv, type RenderView } from './effects';
import { cachedLayer, effectsKey, layerKey, lookOf, MAX_CACHED_SIZE, renderStats } from './layerCache';
import { flatten, referencesOf } from '../project/tree';
import { drawLayer, type RenderEnv } from './layers';

export interface RenderOptions {
  /** Draw the backing and this picture inside the frame (the stage's "show art"). */
  art?: RenderSource | null;
  /** Reuse each layer's picture from earlier renders (default); renders over 2048 px never do. */
  cache?: boolean;
  /**
   * The band to draw on, in place of the one the stage's thickness and
   * spacing make (Token Maker's own band, when it draws a design as a frame).
   * Its shape replaces the stage's; its edges are pixels in from the edge.
   */
  band?: Pick<FrameGeometry, 'shape' | 'outer' | 'inner'>;
  /** Clear the area first (default). Off: draw over what is already there. */
  clear?: boolean;
  /** Show bevels as their height map or normal map (the editor's views); the picture is the default. */
  view?: RenderView;
}

interface StackEnv extends RenderEnv {
  cache: boolean;
  view: RenderView;
  rig?: EffectEnv['rig'];
  /** The rig's settings, for the cache key of pictures with effects. */
  rigKey: string;
}

/** Paints the project into a `size`×`size` area starting at the context's origin. */
export function renderProject(ctx: Ctx, project: FrameProject, size: number, options: RenderOptions = {}): void {
  const R = size / 2;
  const g = options.band ? { ...bandGeometry(project.stage, size), ...options.band } : bandGeometry(project.stage, size);
  ctx.save();
  if (options.clear !== false) ctx.clearRect(0, 0, size, size);
  // Nothing is drawn outside the square, as in token-maker.
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();
  ctx.translate(R, R);

  if (project.stage.showArt) {
    // The opening reaches the middle of the band, where token-maker's art runs to with no inner spacing.
    const opening = shapePolygon(g.shape, R, (g.outer + g.inner) / 2);
    ctx.save();
    tracePolygon(ctx, opening);
    ctx.fillStyle = project.stage.backingColor;
    ctx.fill();
    if (options.art) {
      ctx.clip();
      const box = boundingBox(opening);
      const side = Math.max(box.maxX - box.minX, box.maxY - box.minY);
      const k = side / Math.min(options.art.width, options.art.height);
      const w = options.art.width * k;
      const h = options.art.height * k;
      ctx.drawImage(options.art.image, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  renderStats.drawn = 0;
  renderStats.reused = 0;
  const cache = options.cache !== false && size <= MAX_CACHED_SIZE;
  const byId = new Map(flatten(project.layers).map((l) => [l.id, l]));
  const { lights, ambient, ambientStrength, bloom, bleed } = project.stage;
  const rig = lights.length || ambientStrength > 0 ? { lights, ambient, ambientStrength } : undefined;
  const env: StackEnv = { g, light: project.stage.light, size, cache, find: (id) => byId.get(id), view: options.view ?? 'picture', rig, rigKey: rig ? JSON.stringify(rig) : '' };
  if (bloom > 0 || bleed > 0) {
    // Bloom and bleed work on the whole design, so it is drawn on its own canvas first (over the picture inside).
    const own = scratch(size);
    drawStack(own.ctx, project.layers, env);
    own.ctx.save();
    own.ctx.setTransform(1, 0, 0, 1, 0, 0);
    lightPass(own.ctx, size, bloom, bleed, bandWidthPx(g));
    own.ctx.restore();
    put(ctx, own.canvas, size);
  } else drawStack(ctx, project.layers, env);
  ctx.restore();
}

/** A blank canvas the size of the picture, with its origin at the centre. */
function scratch(size: number): { canvas: CanvasLike; ctx: Ctx } {
  const canvas = newCanvas(size, size);
  const ctx = context2d(canvas);
  ctx.translate(size / 2, size / 2);
  return { canvas, ctx };
}

/** Draws a picture made by `picture` (a full-size canvas) at the origin of a centred context. */
function put(ctx: Ctx, canvas: CanvasLike, size: number): void {
  ctx.drawImage(canvas as CanvasImageSource, -size / 2, -size / 2);
}

/** A layer has effects that are switched on. */
const hasEffects = (layer: Layer) => activeEffects(layer.effects).length > 0;

/**
 * The picture of one layer on its own canvas, with its band clip and (unless
 * `raw`) its effects. A layer that isn't a group comes from the cache when it
 * can (layerCache.ts); so does a group with effects (its key holds its
 * layers' settings); other groups are drawn afresh from their layers'
 * pictures. A layer clipped to this one uses its raw picture as the mask, so
 * its shadow or glow doesn't let the clipped layer spill out.
 */
function picture(layer: Layer, env: StackEnv, raw = false): CanvasLike {
  const effects = !raw && hasEffects(layer);
  const draw = () => {
    const own = scratch(env.size);
    if (effects) {
      // Effects work on the layer's own picture; the band clip is applied again after them.
      put(own.ctx, picture(layer, env, true), env.size);
      own.ctx.save();
      own.ctx.setTransform(1, 0, 0, 1, 0, 0);
      applyEffects(own.ctx, env.size, layer.effects, { bw: bandWidthPx(env.g), light: env.light, view: env.view, rig: env.rig, height: layer.type === 'group' ? sharedHeight(layer, env) : undefined });
      own.ctx.restore();
      if (layer.clip === 'band') {
        const cut = scratch(env.size);
        clipToBand(cut.ctx, env.g);
        put(cut.ctx, own.canvas, env.size);
        return cut.canvas;
      }
      return own.canvas;
    }
    if (layer.clip === 'band') clipToBand(own.ctx, env.g);
    if (layer.type === 'group' && layer.combine !== 'normal') combine(own.ctx, layer, env);
    else if (layer.type === 'group') drawStack(own.ctx, layer.children, env);
    else drawLayer(own.ctx, layer, env);
    return own.canvas;
  };
  if (!env.cache || (layer.type === 'group' && !effects)) return draw();
  const key = layerKey(layer, env.g, env.light, env.size, depsKey(layer, env));
  return effects ? cachedLayer(`${env.size}|${layer.id}|fx`, `${effectsKey(layer, key)}|${env.view}|${env.rigKey}`, env.size, draw) : cachedLayer(`${env.size}|${layer.id}`, key, env.size, draw);
}

/**
 * How a group's layers' shapes combine (version 8): the bottom one, then
 * each one above added to it, cut out of it, overlapped with it or
 * excluded from it. Each layer keeps its own colours where it shows.
 */
function combine(ctx: Ctx, group: Extract<Layer, { type: 'group' }>, env: StackEnv): void {
  const OPS = { union: 'source-over', subtract: 'destination-out', intersect: 'destination-in', exclude: 'xor', normal: 'source-over' } as const;
  let first = true;
  for (const child of group.children) {
    if (!child.visible || child.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = child.opacity;
    ctx.globalCompositeOperation = first ? 'source-over' : OPS[group.combine];
    put(ctx, picture(child, env), env.size);
    ctx.restore();
    first = false;
  }
}

/**
 * A group's shared height map (version 8): every layer in it that raises or
 * carves adds (or takes away) a rounded slope up from its own edge, so the
 * group's bevel lights runes cut into a plate, or a boss standing on it, as
 * one sculpted surface.
 */
function sharedHeight(group: Extract<Layer, { type: 'group' }>, env: StackEnv): Float32Array | undefined {
  const parts = flatten(group.children).filter((l) => l.type !== 'group' && l.visible && l.heightMode !== 'none');
  if (parts.length === 0) return undefined;
  const size = env.size;
  const total = new Float32Array(size * size);
  const bw = bandWidthPx(env.g);
  for (const l of parts) {
    const ctx = context2d(picture(l, env, true));
    const data = ctx.getImageData(0, 0, size, size).data;
    const alpha = new Float32Array(size * size);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] / 255;
    const h = heightContribution(alpha, size, l.heightSize, l.heightDepth, bw);
    const sign = l.heightMode === 'carve' ? -1 : 1;
    for (let i = 0; i < total.length; i++) total[i] += sign * h[i];
  }
  return total;
}

/** Applies a layer's mask to a copy of its picture: another layer's shape or brightness, inverted or not. */
function masked(canvas: CanvasLike, layer: Layer, env: StackEnv): CanvasLike {
  const source = layer.mask && env.find?.(layer.mask.source);
  if (!layer.mask || !source || source.id === layer.id) return canvas;
  const own = scratch(env.size);
  put(own.ctx, canvas, env.size);
  own.ctx.save();
  own.ctx.setTransform(1, 0, 0, 1, 0, 0);
  const image = own.ctx.getImageData(0, 0, env.size, env.size);
  const m = context2d(picture(source, env)).getImageData(0, 0, env.size, env.size).data;
  const px = image.data;
  for (let p = 0; p < px.length; p += 4) {
    let k = m[p + 3] / 255;
    if (layer.mask.mode === 'luminance') k *= (0.2126 * m[p] + 0.7152 * m[p + 1] + 0.0722 * m[p + 2]) / 255;
    if (layer.mask.invert) k = 1 - k;
    px[p + 3] *= k;
  }
  own.ctx.putImageData(image, 0, 0);
  own.ctx.restore();
  return own.canvas;
}

/** The settings of the layers this one (or anything in it) follows, so its picture is drawn again when they change. */
function depsKey(layer: Layer, env: StackEnv): string {
  const refs = (layer.type === 'group' ? flatten(layer.children) : [layer]).flatMap(referencesOf);
  if (refs.length === 0) return '';
  return refs.map((id) => {
    const t = env.find?.(id);
    return t ? JSON.stringify(lookOf(t)) : '-';
  }).join('|');
}

/**
 * Layers bottom first, each from its own picture, so editing one layer
 * redraws only that one. Opacity and blend mode apply to the whole picture,
 * so a layer's opacity is even where its parts overlap. A layer clipped to
 * the one below shows only where that layer (the nearest one below that
 * isn't itself clipped) has paint, like a clipping mask. A group at full
 * opacity and Normal blend passes its layers straight through.
 */
function drawStack(ctx: Ctx, layers: Layer[], env: StackEnv): void {
  let base: Layer | null = null;
  for (const layer of layers) {
    if (layer.clip !== 'below') base = layer;
    if (!layer.visible || layer.opacity <= 0) continue;
    const mask = layer.clip === 'below' ? base : null;
    if (layer.clip === 'below' && (!mask || !mask.visible || mask.opacity <= 0)) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blend;
    if (!mask && !layer.mask && layer.type === 'group' && layer.opacity >= 1 && layer.blend === 'source-over' && layer.combine === 'normal' && !hasEffects(layer)) {
      if (layer.clip === 'band') clipToBand(ctx, env.g);
      drawStack(ctx, layer.children, env);
    } else if (mask) {
      // A copy, so the cached picture itself isn't cut.
      const own = scratch(env.size);
      put(own.ctx, masked(picture(layer, env), layer, env), env.size);
      own.ctx.globalCompositeOperation = 'destination-in';
      put(own.ctx, picture(mask, env, true), env.size);
      put(ctx, own.canvas, env.size);
    } else put(ctx, masked(picture(layer, env), layer, env), env.size);
    ctx.restore();
  }
}
