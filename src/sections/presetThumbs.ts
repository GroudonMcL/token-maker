// Small previews of presets for the Presets section, drawn by the real
// renderer on a stand-in portrait (cached by the look).

import { getAssets } from '../state/assets';
import { frameAssetId } from '../render/imageFrames';
import { renderToken } from '../render/render';
import { sampleArt } from '../render/sampleArt';
import { previewDocument, type TokenPreset } from '../presets/preset';

const cache = new Map<string, string>();
let art: ReturnType<typeof sampleArt> | null = null;

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A data URL of the preset's look on a stand-in portrait, or '' where there is no canvas (tests). */
export function presetThumbnail(p: TokenPreset, px = 88): string {
  const doc = previewDocument(p);
  const frameReady = !doc.frame.image || doc.frame.kind !== 'image' || getAssets().has(frameAssetId(doc.frame.image.source));
  const key = `${JSON.stringify(p.look)}|${px}|${frameReady}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const canvas = makeCanvas(px, px);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  art ??= sampleArt(makeCanvas, 160);
  doc.art.assetId = 'asset:preset-sample';
  renderToken(ctx, doc, new Map([...getAssets(), ['asset:preset-sample', art]]), px);
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  while (cache.size > 60) cache.delete(cache.keys().next().value!);
  return url;
}
