// Small previews of every effect for the effect picker, drawn by the real
// renderer on the current shape and frame (cached).

import { createDocument, EFFECTS, newEffect } from '../document/defaults';
import type { TokenDocument } from '../document/types';
import { renderToken } from '../render/render';
import { cutOutArt } from '../render/sampleArt';

const cache = new Map<string, Map<string, string>>();

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Data URLs of each effect's thumbnail on this token's shape and frame, keyed by effect kind. */
export function effectThumbnails(token: Pick<TokenDocument, 'shape' | 'frame'>, px = 96): Map<string, string> {
  const { style, color, thickness, outerSpacing, innerSpacing, highlightColor } = token.frame;
  const key = JSON.stringify([token.shape, style, color, thickness, outerSpacing, innerSpacing, highlightColor, px]);
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = makeCanvas(px, px);
  const ctx = canvas.getContext('2d');
  const out = new Map<string, string>();
  if (!ctx) return out; // no canvas (tests): tiles show without pictures
  const assets = new Map([['asset:sample', cutOutArt(makeCanvas, 128)]]);
  for (const info of EFFECTS) {
    if (info.kind === 'picture') continue; // pictures show themselves in the picker
    const doc = createDocument();
    doc.shape = token.shape;
    doc.frame = { ...token.frame };
    doc.art.assetId = 'asset:sample';
    doc.background = { ...doc.background, kind: 'color', color: '#41566e' };
    doc.effects = [newEffect(info.kind, 'thumb')];
    renderToken(ctx, doc, assets, px);
    out.set(info.kind, canvas.toDataURL('image/png'));
  }
  cache.set(key, out);
  while (cache.size > 6) cache.delete(cache.keys().next().value!);
  return out;
}
