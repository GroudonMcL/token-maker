// Renders every decoration (at its default snap point, with mirroring as it
// starts) and every built-in picture frame on one sheet, for checking by eye
// like the frame and effect sheets. Uses the same renderer and the same hole
// detection as the site.
//   npm run decoration-sheet -- out.png [size]
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'node:fs';
import { createDocument, DECORATIONS, newDecoration } from '../src/document/defaults';
import type { TokenDocument } from '../src/document/types';
import { findFrameHole } from '../src/image/frameHole';
import { setCanvasFactory } from '../src/image/processedArt';
import type { Ctx } from '../src/render/frameKit';
import { FRAME_LIBRARY, frameAssetId } from '../src/render/imageFrames';
import { renderToken, type RenderSource } from '../src/render/render';
import { sampleArt } from '../src/render/sampleArt';

const out = process.argv[2] ?? 'decoration-sheet.png';
const size = Number(process.argv[3] ?? 220);
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);

const cols = 6;
const label = 24;
const frames = await Promise.all(
  FRAME_LIBRARY.map(async (f) => {
    const img = await loadImage(readFileSync(`public/frames/${f.id}.webp`));
    const c = createCanvas(img.width, img.height);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const small = createCanvas(512, 512);
    small.getContext('2d').drawImage(c, 0, 0, 512, 512);
    const data = small.getContext('2d').getImageData(0, 0, 512, 512);
    return { f, source: { image: c, width: img.width, height: img.height } as unknown as RenderSource, hole: findFrameHole(data) };
  }),
);

const cells = DECORATIONS.length + frames.length;
const rows = Math.ceil(cells / cols);
const sheet = createCanvas(cols * size, rows * (size + label));
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#3a3d46';
ctx.fillRect(0, 0, sheet.width, sheet.height);
const art = sampleArt(make);

function cell(i: number, name: string, doc: TokenDocument, assets: Map<string, RenderSource>) {
  const x = (i % cols) * size;
  const y = Math.floor(i / cols) * (size + label);
  const c = createCanvas(size, size);
  renderToken(c.getContext('2d') as unknown as Ctx, doc, assets, size);
  ctx.drawImage(c, x, y + label);
  ctx.fillStyle = '#f0e6cc';
  ctx.font = '15px sans-serif';
  ctx.fillText(name, x + 8, y + 17);
}

DECORATIONS.forEach((info, i) => {
  const doc = createDocument();
  doc.art.assetId = 'asset:sample';
  doc.decorations = [newDecoration(info.kind, 'd')];
  cell(i, info.name, doc, new Map([['asset:sample', art]]));
});
frames.forEach(({ f, source, hole }, i) => {
  const doc = createDocument();
  doc.art.assetId = 'asset:sample';
  doc.frame = { ...doc.frame, kind: 'image', image: { source: { type: 'library', id: f.id }, name: f.name, hole: hole.hole, outer: hole.outer, nudge: { x: 0, y: 0, scale: 1 } } };
  cell(DECORATIONS.length + i, `${f.name}${hole.found ? '' : ' (no hole!)'}`, doc, new Map([['asset:sample', art], [frameAssetId(doc.frame.image!.source), source]]));
});
writeFileSync(out, sheet.toBuffer('image/png'));
console.log(`Wrote ${out}`);
