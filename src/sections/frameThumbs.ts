// Small previews of every frame for the frame picker, drawn once per shape
// by the real renderer (cached).

import { createDocument } from '../document/defaults';
import { FRAME_PRESETS, type ShapeId } from '../render/catalog';
import { renderToken } from '../render/render';
import { sampleArt } from '../render/sampleArt';

const cache = new Map<string, Map<string, string>>();

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Data URLs of each frame preset's thumbnail for `shape`, keyed by preset id. */
export function frameThumbnails(shape: ShapeId, px = 96): Map<string, string> {
  const key = `${shape}|${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const art = sampleArt(makeCanvas, 128);
  const assets = new Map([['asset:sample', art]]);
  const out = new Map<string, string>();
  const canvas = makeCanvas(px, px);
  const ctx = canvas.getContext('2d');
  if (!ctx) return out; // no canvas (tests): tiles show without pictures
  for (const p of FRAME_PRESETS) {
    const doc = createDocument();
    doc.shape = shape;
    doc.art.assetId = 'asset:sample';
    doc.frame = { ...doc.frame, presetId: p.id, style: p.style, color: p.color };
    renderToken(ctx, doc, assets, px);
    out.set(p.id, canvas.toDataURL('image/png'));
  }
  cache.set(key, out);
  return out;
}
