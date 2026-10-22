// Renders every frame on one sheet for checking by eye (like the extension's).
//   npm run frame-sheet -- out.png [circle|rounded|square|hexagon|flatHex] [size] [squares]
// Opens fine in any image viewer. Uses the same renderer as the site.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createDocument } from '../src/document/defaults';
import type { ShapeId } from '../src/render/catalog';
import { FRAME_GROUPS, FRAME_PRESETS } from '../src/render/catalog';
import type { Ctx } from '../src/render/frameKit';
import { renderToken } from '../src/render/render';
import { sampleArt } from '../src/render/sampleArt';

const out = process.argv[2] ?? 'frame-sheet.png';
const shape = (process.argv[3] ?? 'circle') as ShapeId;
const size = Number(process.argv[4] ?? 220);
const squares = Number(process.argv[5] ?? 1);
const cols = 6;
const label = 26;
const rows = FRAME_GROUPS.reduce((n, g) => n + Math.ceil(FRAME_PRESETS.filter((p) => p.group === g).length / cols), 0);
const sheet = createCanvas(cols * size, rows * (size + label) + FRAME_GROUPS.length * 34);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#3a3d46';
ctx.fillRect(0, 0, sheet.width, sheet.height);
const art = sampleArt((w, h) => createCanvas(w, h) as unknown as HTMLCanvasElement);
const assets = new Map([['asset:sample', art]]);

let y = 0;
for (const group of FRAME_GROUPS) {
  ctx.fillStyle = '#f0e6cc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(group, 12, y + 25);
  y += 34;
  const presets = FRAME_PRESETS.filter((p) => p.group === group);
  presets.forEach((p, i) => {
    const x = (i % cols) * size;
    const yy = y + Math.floor(i / cols) * (size + label);
    const doc = createDocument();
    doc.shape = shape;
    doc.size = { preset: 'custom', squares };
    doc.art.assetId = 'asset:sample';
    doc.frame = { ...doc.frame, presetId: p.id, style: p.style, color: p.color };
    const c = createCanvas(size, size);
    renderToken(c.getContext('2d') as unknown as Ctx, doc, assets, size);
    ctx.drawImage(c, x, yy);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText(p.name, x + 10, yy + size + 18);
  });
  y += Math.ceil(presets.length / cols) * (size + label);
}
writeFileSync(out, sheet.toBuffer('image/png'));
console.log(`Wrote ${out}`);
