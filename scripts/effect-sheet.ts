// Renders every effect in each placement on one sheet for checking by eye
// (like the frame sheet). Uses the same renderer as the site.
//   npm run effect-sheet -- out.png [circle|rounded|square|hexagon|flatHex] [size] [squares]
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createDocument, EFFECTS, newEffect } from '../src/document/defaults';
import type { EffectPlacement } from '../src/document/types';
import { setCanvasFactory } from '../src/image/processedArt';
import type { ShapeId } from '../src/render/catalog';
import type { Ctx } from '../src/render/frameKit';
import { renderToken } from '../src/render/render';
import { cutOutArt } from '../src/render/sampleArt';

const out = process.argv[2] ?? 'effect-sheet.png';
const shape = (process.argv[3] ?? 'circle') as ShapeId;
const size = Number(process.argv[4] ?? 200);
const squares = Number(process.argv[5] ?? 1);
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);

const PLACEMENTS: [EffectPlacement, string][] = [
  ['behind', 'Behind art'],
  ['over', 'Over art'],
  ['border', 'On border'],
];
const name = 150;
const head = 30;
const sheet = createCanvas(name + PLACEMENTS.length * size, head + EFFECTS.length * size);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#3a3d46';
ctx.fillRect(0, 0, sheet.width, sheet.height);
ctx.fillStyle = '#f0e6cc';
ctx.font = 'bold 18px sans-serif';
PLACEMENTS.forEach(([, label], i) => ctx.fillText(label, name + i * size + 10, 21));
const assets = new Map([['asset:sample', cutOutArt(make)]]);

EFFECTS.forEach((info, row) => {
  const y = head + row * size;
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText(info.name, 10, y + size / 2);
  PLACEMENTS.forEach(([placement], col) => {
    const doc = createDocument();
    doc.shape = shape;
    doc.size = { preset: 'custom', squares };
    doc.art.assetId = 'asset:sample';
    doc.background = { ...doc.background, kind: 'color', color: '#41566e' };
    doc.effects = [{ ...newEffect(info.kind, 'fx'), placement }];
    const c = createCanvas(size, size);
    renderToken(c.getContext('2d') as unknown as Ctx, doc, assets, size);
    ctx.drawImage(c, name + col * size, y);
  });
});
writeFileSync(out, sheet.toBuffer('image/png'));
console.log(`Wrote ${out}`);
