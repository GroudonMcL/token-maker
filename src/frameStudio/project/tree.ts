// Layers form a tree: groups hold their own bottom-first list of layers. These
// helpers find, change, remove and insert layers anywhere in it without
// changing the lists they are given.

import type { GroupLayer, Layer } from './types';

export interface Located {
  layer: Layer;
  /** The group holding it, or null at the top level. */
  parent: GroupLayer | null;
  /** Its position in its parent's list (0 = bottom). */
  index: number;
  /** Groups from the top level down to its parent. */
  ancestors: GroupLayer[];
}

export function locate(layers: Layer[], id: string, ancestors: GroupLayer[] = []): Located | null {
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (layer.id === id) return { layer, parent: ancestors.at(-1) ?? null, index: i, ancestors };
    if (layer.type === 'group') {
      const found = locate(layer.children, id, [...ancestors, layer]);
      if (found) return found;
    }
  }
  return null;
}

export const findLayer = (layers: Layer[], id: string | null) => (id === null ? undefined : (locate(layers, id)?.layer ?? undefined));

/** Every layer, depth first, bottom first; groups come before their children. */
export function flatten(layers: Layer[]): Layer[] {
  return layers.flatMap((l) => (l.type === 'group' ? [l, ...flatten(l.children)] : [l]));
}

/** The list with layer `id` replaced by `fn(layer)`, wherever it is. */
export function mapLayer(layers: Layer[], id: string, fn: (l: Layer) => Layer): Layer[] {
  let changed = false;
  const out = layers.map((l) => {
    if (l.id === id) {
      changed = true;
      return fn(l);
    }
    if (l.type === 'group') {
      const children = mapLayer(l.children, id, fn);
      if (children !== l.children) {
        changed = true;
        return { ...l, children };
      }
    }
    return l;
  });
  return changed ? out : layers;
}

/** The list without layer `id` (and its children). */
export function removeLayer(layers: Layer[], id: string): Layer[] {
  const out: Layer[] = [];
  let changed = false;
  for (const l of layers) {
    if (l.id === id) {
      changed = true;
      continue;
    }
    if (l.type === 'group') {
      const children = removeLayer(l.children, id);
      if (children !== l.children) {
        changed = true;
        out.push({ ...l, children });
        continue;
      }
    }
    out.push(l);
  }
  return changed ? out : layers;
}

/** Inserts `layer` at `index` in group `parentId`'s list (null = the top level). */
export function insertLayer(layers: Layer[], parentId: string | null, index: number, layer: Layer): Layer[] {
  const put = (list: Layer[]) => {
    const next = [...list];
    next.splice(Math.max(0, Math.min(next.length, index)), 0, layer);
    return next;
  };
  if (parentId === null) return put(layers);
  return mapLayer(layers, parentId, (g) => (g.type === 'group' ? { ...g, children: put(g.children) } : g));
}

/** True if the layer or a group holding it is locked. */
export function isLocked(layers: Layer[], id: string): boolean {
  const found = locate(layers, id);
  return !!found && (found.layer.locked || found.ancestors.some((g) => g.locked));
}

/** True if the layer and every group holding it are visible. */
export function isShown(layers: Layer[], id: string): boolean {
  const found = locate(layers, id);
  return !!found && found.layer.visible && found.ancestors.every((g) => g.visible);
}

/** A deep copy of a layer with fresh ids for it and everything inside it. */
export function cloneWithNewIds(layer: Layer, newId: () => string): Layer {
  const copy = structuredClone(layer);
  const renew = (l: Layer) => {
    l.id = newId();
    if (l.type === 'group') l.children.forEach(renew);
  };
  renew(copy);
  return copy;
}
