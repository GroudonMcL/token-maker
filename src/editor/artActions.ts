// Toolbar and keyboard actions on the art's position (DESIGN.md §6.2 Transform).

import type { ArtTransform, TokenDocument } from '../document/types';
import {
  clampTransform,
  fillTransform,
  fitTransform,
  imageClipPolygon,
  normaliseAngle,
  resetTransform,
  zoomAround,
} from '../render/geometry';
import { getAssets } from '../state/assets';
import { getDoc, updateDoc } from '../state/tokenStore';

function current() {
  const doc = getDoc();
  const art = doc.art.assetId ? getAssets().get(doc.art.assetId) : undefined;
  return art ? { doc, art, clip: imageClipPolygon(doc) } : null;
}

/** Applies a change to the art transform, clamped to "Keep the frame filled" if on. */
export function setTransform(
  change: (t: ArtTransform, size: { w: number; h: number; clip: ReturnType<typeof imageClipPolygon> }) => ArtTransform,
  opts?: { transient?: boolean; noClamp?: boolean },
): void {
  const c = current();
  if (!c) return;
  const ctx = { w: c.art.width, h: c.art.height, clip: c.clip };
  const next = change(c.doc.art.transform, ctx);
  const t = opts?.noClamp ? next : clampTransform(next, ctx.w, ctx.h, ctx.clip);
  updateDoc((doc) => ({ ...doc, art: { ...doc.art, transform: t } }), opts);
}

export const artActions = {
  zoomTo: (zoom: number, transient = false) =>
    setTransform((t) => zoomAround(t, zoom / t.zoom, { x: 0, y: 0 }), { transient }),
  rotate90: () => setTransform((t) => ({ ...t, rotation: normaliseAngle(t.rotation + 90) })),
  flipX: () => setTransform((t) => ({ ...t, flipX: !t.flipX })),
  flipY: () => setTransform((t) => ({ ...t, flipY: !t.flipY })),
  fit: () => setTransform((t, s) => fitTransform(t, s.w, s.h, s.clip), { noClamp: true }),
  fill: () => setTransform((t, s) => fillTransform(t, s.w, s.h, s.clip)),
  reset: () => setTransform((_t, s) => resetTransform(s.w, s.h, s.clip)),
};

/**
 * Changes something that moves the frame's inner edge (shape, size, spacing)
 * and, in the same undo step, keeps the art covering the frame if locked.
 */
export function updateFrameAndArt(recipe: (doc: TokenDocument) => TokenDocument, opts?: { transient?: boolean }): void {
  updateDoc((doc) => {
    const next = recipe(doc);
    const art = next.art.assetId ? getAssets().get(next.art.assetId) : undefined;
    if (!art || !next.art.transform.lockFill) return next;
    const transform = clampTransform(next.art.transform, art.width, art.height, imageClipPolygon(next));
    return { ...next, art: { ...next.art, transform } };
  }, opts);
}
