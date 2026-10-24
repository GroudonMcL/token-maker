// Small previews of every frame for the frame picker, drawn once per shape
// by the real renderer (cached).

import { createDocument } from '../document/defaults';
import type { DesignFrame } from '../document/types';
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
  const out = new Map<string, string>();
  const canvas = makeCanvas(px, px);
  const ctx = canvas.getContext('2d');
  if (!ctx) return out; // no canvas (tests): tiles show without pictures
  const art = sampleArt(makeCanvas, 128);
  const assets = new Map([['asset:sample', art]]);
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

const designCache = new Map<string, string>();

/** A data URL of a Frame Studio design as a frame on `shape`, drawn by the real renderer on a default token (cached by design id). */
export function designThumbnail(id: string, project: DesignFrame['project'], shape: ShapeId, px = 96): string | null {
  const key = `${id}|${shape}|${px}`;
  const hit = designCache.get(key);
  if (hit) return hit;
  const canvas = makeCanvas(px, px);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const doc = createDocument();
  doc.shape = shape;
  doc.art.assetId = 'asset:sample';
  doc.frame = { ...doc.frame, kind: 'design', design: { id, name: project.name, project } };
  renderToken(ctx, doc, new Map([['asset:sample', sampleArt(makeCanvas, 128)]]), px);
  const url = canvas.toDataURL('image/png');
  designCache.set(key, url);
  return url;
}
