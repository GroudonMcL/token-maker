// Small pictures of every decoration for the picker, drawn by the same
// painters as the renderer (cached).

import { DECORATIONS } from '../document/defaults';
import { DECORATION_PAINTERS } from '../render/decorationPainters';
import type { Ctx } from '../render/frameKit';

let cache: Map<string, string> | null = null;

/** Data URLs of each decoration's picture in its starting colour, keyed by kind. */
export function decorationThumbnails(px = 88): Map<string, string> {
  if (cache) return cache;
  const out = new Map<string, string>();
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) return out; // no canvas (tests): tiles show without pictures
  for (const info of DECORATIONS) {
    if (info.kind === 'picture') continue; // pictures show themselves in the picker
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    // Fit the picture's box (aspect × 100 by 100) into the tile with a little room.
    const k = (px * 0.84) / Math.max(info.aspect * 100, 100);
    ctx.translate((px - info.aspect * 100 * k) / 2, (px - 100 * k) / 2);
    ctx.scale(k, k);
    DECORATION_PAINTERS[info.kind](ctx, info.defaults.color, info.aspect * 100);
    out.set(info.kind, canvas.toDataURL('image/png'));
  }
  cache = out;
  return out;
}
