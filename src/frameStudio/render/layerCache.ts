// Each layer's picture, kept between renders (DESIGN.md §5.3). A layer is
// drawn on its own canvas once and reused until its settings, the stage or
// the size change, so editing one layer doesn't redraw the others. Opacity
// and blend mode are applied when the picture is composited, so changing
// them redraws nothing.

import type { FrameGeometry } from '../../render/frameKit';
import type { Layer } from '../project/types';
import type { CanvasLike } from './canvas';

/** Renders bigger than this are not cached (like token-maker's frame cache). */
export const MAX_CACHED_SIZE = 2048;
/** Pixels kept in all, about 128 MB. The least recently used pictures go first. */
const BUDGET = 32_000_000;

interface Entry {
  canvas: CanvasLike;
  pixels: number;
}

const entries = new Map<string, Entry>();
/** The key each layer (by size and id) was last drawn with, so a stale picture is dropped as soon as it is replaced. */
const slots = new Map<string, string>();
let used = 0;

/** How many layers the last render drew, and how many it reused. */
export const renderStats = { drawn: 0, reused: 0 };

/** Everything that changes how a layer looks, but not how it is composited: its settings, the band, the light and the size. */
export function layerKey(layer: Layer, g: Pick<FrameGeometry, 'shape' | 'outer' | 'inner'>, light: number, size: number): string {
  const { id: _i, name: _n, visible: _v, locked: _l, opacity: _o, blend: _b, clip, ...look } = layer;
  return `${size}|${g.shape}|${g.outer}|${g.inner}|${light}|${clip === 'band' ? 'band' : ''}|${JSON.stringify(look)}`;
}

function drop(key: string): void {
  const e = entries.get(key);
  if (!e) return;
  entries.delete(key);
  used -= e.pixels;
}

/** The cached picture for `key`, or a new one made by `draw` (and kept). */
export function cachedLayer(slot: string, key: string, size: number, draw: () => CanvasLike): CanvasLike {
  const hit = entries.get(key);
  if (hit) {
    // Most recently used last.
    entries.delete(key);
    entries.set(key, hit);
    slots.set(slot, key);
    renderStats.reused++;
    return hit.canvas;
  }
  const previous = slots.get(slot);
  if (previous && previous !== key) drop(previous);
  const canvas = draw();
  renderStats.drawn++;
  const pixels = size * size;
  entries.set(key, { canvas, pixels });
  slots.set(slot, key);
  used += pixels;
  for (const [k] of entries) {
    if (used <= BUDGET || k === key) break;
    drop(k);
  }
  return canvas;
}

/** Forgets every cached picture (tests, or to free memory). */
export function clearLayerCache(): void {
  entries.clear();
  slots.clear();
  used = 0;
}

export const cacheSize = () => entries.size;
