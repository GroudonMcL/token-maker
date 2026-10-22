// Draws the before/after pictures for the Image section's help tips
// (DESIGN.md §11) with the real image pipeline, into public/help/.
// Run with: npm run help-images
import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULT_ADJUST, DEFAULT_REMOVAL } from '../src/document/defaults';
import type { ImageAdjustments, MaskStroke } from '../src/document/types';
import type { PixelBuffer } from '../src/image/adjust';
import { blurImage } from '../src/image/filters';
import { processPixels, type ArtEdits } from '../src/image/process';

const T = 240; // each half
const OUT = 'public/help';

type Crop = { file: string; x: number; y: number; size: number };
const HEAD: Crop = { file: 'e2e/fixtures/goblin-boss.png', x: 60, y: 120, size: 480 };
const FLAT: Crop = { file: 'e2e/fixtures/flat-goblin.png', x: 0, y: 100, size: 600 };
const EAR: Crop = { file: 'e2e/fixtures/flat-goblin.png', x: 380, y: 170, size: 140 };

async function crop(c: Crop, noise = 0): Promise<PixelBuffer> {
  const img = await loadImage(c.file);
  const canvas = createCanvas(T, T);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, c.x, c.y, c.size, c.size, 0, 0, T, T);
  const data = ctx.getImageData(0, 0, T, T).data;
  if (noise) {
    // A slightly uneven "flat" background, like a scan or a JPEG.
    let seed = 7;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! < 240) continue;
      seed = (seed * 16807) % 2147483647;
      const n = ((seed / 2147483647) * 2 - 1) * noise;
      for (let k = 0; k < 3; k++) data[i + k] = data[i + k]! + n;
    }
  }
  return { data: new Uint8ClampedArray(data), width: T, height: T };
}

const edits = (adjust: Partial<ImageAdjustments> = {}, more: Partial<ArtEdits> = {}): ArtEdits => ({
  adjust: { ...DEFAULT_ADJUST, ...adjust },
  removal: { ...DEFAULT_REMOVAL },
  strokes: [],
  ...more,
});
const removal = (patch: Partial<ArtEdits['removal']> = {}) => ({ ...DEFAULT_REMOVAL, enabled: true, ...patch });
const run = (src: PixelBuffer, e: ArtEdits) => processPixels(src, e).pixels;
const line = (mode: MaskStroke['mode'], size: number, softness = 0, pressure: number[] = [1, 1, 1]): MaskStroke => ({
  mode,
  size,
  softness,
  points: [0.2, 0.75, pressure[0]!, 0.5, 0.82, pressure[1]!, 0.8, 0.75, pressure[2]!],
});

/** A half of the picture: checkerboard behind see-through parts, optional red "removed" tint. */
function half(p: PixelBuffer, tint?: Uint8Array | null): Canvas {
  const c = createCanvas(T, T);
  const ctx = c.getContext('2d');
  for (let y = 0; y < T; y += 12) {
    for (let x = 0; x < T; x += 12) {
      ctx.fillStyle = (x + y) % 24 ? '#cfcfcf' : '#f2f2f2';
      ctx.fillRect(x, y, 12, 12);
    }
  }
  const layer = createCanvas(T, T);
  const lctx = layer.getContext('2d');
  const img = lctx.createImageData(T, T);
  img.data.set(p.data);
  lctx.putImageData(img, 0, 0);
  ctx.drawImage(layer, 0, 0);
  if (tint) {
    const red = lctx.createImageData(T, T);
    for (let i = 0; i < tint.length; i++) {
      red.data.set([230, 40, 40, (255 - tint[i]!) * 0.5], i * 4);
    }
    lctx.putImageData(red, 0, 0);
    ctx.drawImage(layer, 0, 0);
  }
  return c;
}

function save(name: string, before: Canvas, after: Canvas) {
  const gap = 8;
  const c = createCanvas(T * 2 + gap, T);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a251f';
  ctx.fillRect(0, 0, c.width, T);
  ctx.drawImage(before, 0, 0);
  ctx.drawImage(after, T + gap, 0);
  // A small arrow from "before" to "after".
  ctx.fillStyle = '#d6a24e';
  ctx.beginPath();
  ctx.moveTo(T - 6, T / 2 - 14);
  ctx.lineTo(T + gap + 10, T / 2);
  ctx.lineTo(T - 6, T / 2 + 14);
  ctx.closePath();
  ctx.fill();
  writeFileSync(`${OUT}/${name}.webp`, c.toBuffer('image/webp', 82));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const head = await crop(HEAD);
  const flat = await crop(FLAT);
  const noisy = await crop(FLAT, 14);
  const ear = await crop(EAR);
  const pair = (name: string, src: PixelBuffer, e: ArtEdits) => save(name, half(src), half(run(src, e)));

  pair('image-brightness', head, edits({ brightness: 45 }));
  pair('image-contrast', head, edits({ contrast: 60 }));
  pair('image-saturation', head, edits({ saturation: 80 }));
  pair('image-advanced', head, edits({ hue: 30, temperature: 40, sepia: 25, shadows: 40 }));
  pair('image-hue', head, edits({ hue: 140 }));
  pair('image-temperature', head, edits({ temperature: 90 }));
  pair('image-tint', head, edits({ tint: 90 }));
  pair('image-exposure', head, edits({ exposure: 60 }));
  pair('image-highlights', head, edits({ highlights: -100 }));
  pair('image-shadows', head, edits({ shadows: 100 }));
  pair('image-blur', head, edits({ blur: 60 }));
  pair('image-vibrance', head, edits({ vibrance: 100 }));
  pair('image-grayscale', head, edits({ grayscale: 100 }));
  pair('image-sepia', head, edits({ sepia: 100 }));
  pair('image-invert', head, edits({ invert: true }));
  const soft = { ...head, data: head.data.slice() };
  blurImage(soft, 1.6);
  pair('image-sharpness', soft, edits({ sharpness: 100 }));

  pair('image-removeBg', flat, edits({}, { removal: removal() }));
  pair('image-bgColour', flat, edits({}, { removal: removal() }));
  save('image-intensity', half(run(noisy, edits({}, { removal: removal({ intensity: 2, softness: 0 }) }))), half(run(noisy, edits({}, { removal: removal({ intensity: 25, softness: 0 }) }))));
  save('image-softness', half(run(ear, edits({}, { removal: removal({ softness: 0 }) }))), half(run(ear, edits({}, { removal: removal({ softness: 100 }) }))));

  const removed = edits({}, { removal: removal() });
  const erased = { ...removed, strokes: [line('erase', 0.12)] };
  save('image-brush', half(run(flat, removed)), half(run(flat, erased)));
  save('image-brushMode', half(run(flat, erased)), half(run(flat, { ...erased, strokes: [line('erase', 0.12), { ...line('restore', 0.12), points: [0.5, 0.82, 1] }] })));
  save('image-brushSize', half(run(flat, { ...removed, strokes: [line('erase', 0.04)] })), half(run(flat, { ...removed, strokes: [line('erase', 0.16)] })));
  save('image-brushSoftness', half(run(flat, { ...removed, strokes: [line('erase', 0.14, 0)] })), half(run(flat, { ...removed, strokes: [line('erase', 0.14, 1)] })));
  save('image-brushAdvanced', half(run(flat, { ...removed, strokes: [line('erase', 0.14, 0)] })), half(run(flat, { ...removed, strokes: [line('erase', 0.14, 1)] })));
  save('image-pressure', half(run(flat, { ...removed, strokes: [line('erase', 0.12)] })), half(run(flat, { ...removed, strokes: [line('erase', 0.12, 0, [0.1, 1, 0.1])] })));
  const mask = processPixels(flat, erased).mask;
  save('image-showRemoved', half(run(flat, erased)), half(flat, mask));

  console.log(`Wrote the help pictures to ${OUT}/`);
}

void main();
