// Renders every label shape and every bundled font on one sheet, for
// checking by eye like the frame and decoration sheets. Uses the same
// renderer as the site, with the same font files.
//   npm run label-sheet -- out.png [size]
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { createDocument, LABEL_SHAPES, newLabel, RING_TEXT_STYLE } from '../src/document/defaults';
import type { LabelSettings, TokenDocument } from '../src/document/types';
import { FONTS } from '../src/fonts/catalog';
import { setCanvasFactory } from '../src/image/processedArt';
import type { Ctx } from '../src/render/frameKit';
import { renderToken, type RenderSource } from '../src/render/render';
import { sampleArt } from '../src/render/sampleArt';
import type { ShapeId } from '../src/render/catalog';
import { registerBundledFonts } from './nodeFonts';

const out = process.argv[2] ?? 'label-sheet.png';
const size = Number(process.argv[3] ?? 220);
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);
registerBundledFonts();

const art = sampleArt(make);
const cells: { name: string; doc: TokenDocument }[] = [];
const token = (name: string, label: Partial<LabelSettings>, patch: Partial<TokenDocument> = {}) => {
  const doc = { ...createDocument('Goblin Boss'), ...patch };
  doc.art.assetId = 'asset:sample';
  doc.label = { ...newLabel(), ...label };
  cells.push({ name, doc });
};

for (const s of LABEL_SHAPES) token(s.name, { shape: s.id, ...(s.id === 'ring' ? RING_TEXT_STYLE : {}) });
token('Banner, top', { place: 'top', curve: -25 });
token('Straight banner', { curve: 0 });
token('Sharp box', { shape: 'box', corners: 'sharp', fill: '#1c2433', color: '#f2e4c4', outline: { width: 0.02, color: '#d6a24e' } });
token('Long name, shrunk', { text: 'Grimbold the Unbearably Long-Winded' });
token('Long name, grows', { text: 'Grimbold the Long-Winded', shrinkToFit: false, shape: 'pill' });
token('Large token', { shape: 'plaque' }, { size: { preset: 'large', squares: 2 } });
for (const shape of ['square', 'hexagon', 'flatHex', 'rounded'] as ShapeId[]) token(`Ring on ${shape}`, { shape: 'ring', ...RING_TEXT_STYLE }, { shape });
token('Ring, top', { shape: 'ring', place: 'top', ...RING_TEXT_STYLE });
for (const f of FONTS) token(f.name, { font: f.id, text: f.name, bold: false });

const cols = 6;
const caption = 24;
const rows = Math.ceil(cells.length / cols);
const sheet = createCanvas(cols * size, rows * (size + caption));
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#3a3d46';
ctx.fillRect(0, 0, sheet.width, sheet.height);
cells.forEach(({ name, doc }, i) => {
  const x = (i % cols) * size;
  const y = Math.floor(i / cols) * (size + caption);
  const c = createCanvas(size, size);
  renderToken(c.getContext('2d') as unknown as Ctx, doc, new Map<string, RenderSource>([['asset:sample', art]]), size);
  ctx.drawImage(c, x, y + caption);
  ctx.fillStyle = '#f0e6cc';
  ctx.font = '15px sans-serif';
  ctx.fillText(name, x + 8, y + 17);
});
writeFileSync(out, sheet.toBuffer('image/png'));
console.log(`Wrote ${out} (${cells.length} labels)`);
