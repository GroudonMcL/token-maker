// @vitest-environment node
// The export (DESIGN.md §6.11): every format and resolution draws the same
// picture as the preview's renderer, file names are safe, and a batch ZIP
// holds one named file per token.
import { createCanvas } from '@napi-rs/canvas';
import { unzipSync } from 'fflate';
import { createDocument } from '../document/defaults';
import { setCanvasFactory } from '../image/processedArt';
import type { Ctx } from '../render/frameKit';
import { renderToken, type RenderSource } from '../render/render';
import { sampleArt } from '../render/sampleArt';
import { frameTimes } from './animated';
import { encodeCanvas, FormatUnsupportedError, renderForExport } from './exportToken';
import { baseNameFor, safeFileName, uniqueFileNames } from './exportSettings';
import { finalSize, FORMAT_IDS, PX_PRESETS } from './formats';
import { packZip } from './zip.worker';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);
// The renderer makes its canvases with OffscreenCanvas outside a page.
(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = function (w: number, h: number) {
  return createCanvas(w, h);
};

const art: RenderSource = sampleArt(make, 200);
const assets = new Map([['asset:a', art]]);
const doc = (squares = 1) => {
  const d = createDocument('Goblin Boss');
  return { ...d, size: { preset: 'custom' as const, squares }, art: { ...d.art, assetId: 'asset:a' } };
};

/** What the preview's renderer draws at this size. */
function preview(d: ReturnType<typeof doc>, size: number) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  renderToken(ctx as unknown as Ctx, d, assets, size);
  return ctx.getImageData(0, 0, size, size).data;
}

const pixels = (c: unknown) => {
  const canvas = c as ReturnType<typeof createCanvas>;
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
};

describe('export resolution', () => {
  it.each([...PX_PRESETS, 77])('at %i px per square the export is the preview, pixel for pixel', (px) => {
    for (const squares of [0.5, 1, 2]) {
      const d = doc(squares);
      const out = renderForExport(d, assets, { pxPerSquare: px }) as unknown as ReturnType<typeof createCanvas>;
      const side = Math.round(squares * px);
      expect(out.width).toBe(side);
      expect(Buffer.compare(Buffer.from(pixels(out)), Buffer.from(preview(d, side)))).toBe(0);
    }
  });

  it('caps the longest side at 4096 px and says so', () => {
    expect(finalSize(4, 512)).toEqual({ side: 2048, capped: false });
    expect(finalSize(4, 2000)).toEqual({ side: 4096, capped: true });
    expect(finalSize(0.5, 256)).toEqual({ side: 128, capped: false });
  });
});

describe('export formats', () => {
  it('only offers see-through formats (JPG was removed), and keeps the corners see-through', () => {
    expect(FORMAT_IDS).toEqual(['png', 'webp']);
    for (const format of FORMAT_IDS) {
      void format;
      const out = renderForExport(doc(), assets, { pxPerSquare: 128 });
      const data = pixels(out);
      const corner = [...data.slice(0, 4)];
      expect(corner[3]).toBe(0);
      // The middle is the art, the same in every format.
      const i = (64 * 128 + 64) * 4;
      expect([...data.slice(i, i + 4)]).toEqual([...preview(doc(), 128).slice(i, i + 4)]);
    }
  });

  it('asks the browser for the right file type and quality', async () => {
    const calls: unknown[] = [];
    const canvas = { convertToBlob: async (o: { type: string; quality?: number }) => (calls.push(o), new Blob(['x'], { type: o.type })) };
    expect((await encodeCanvas(canvas as unknown as OffscreenCanvas, 'webp', 80)).type).toBe('image/webp');
    await encodeCanvas(canvas as unknown as OffscreenCanvas, 'png', 80);
    expect(calls).toEqual([
      { type: 'image/webp', quality: 0.8 },
      { type: 'image/png', quality: undefined },
    ]);
  });

  it('says so when the browser quietly writes a PNG instead (Safari and WebP)', async () => {
    const canvas = { convertToBlob: async () => new Blob(['x'], { type: 'image/png' }) };
    await expect(encodeCanvas(canvas as unknown as OffscreenCanvas, 'webp', 90)).rejects.toBeInstanceOf(FormatUnsupportedError);
  });
});

describe('file names', () => {
  it('only keeps safe characters', () => {
    expect(safeFileName('Goblin Boss', 'webp')).toBe('Goblin-Boss.webp');
    expect(safeFileName('Ælf / Thing: "Ünder" <3', 'webp')).toBe('lf-Thing-Under-3.webp');
    expect(safeFileName('???', 'png')).toBe('token.png');
  });

  it('uses a typed file name only for the token it was typed for', () => {
    expect(baseNameFor('Goblin Boss', { fileName: { text: 'boss final', forName: 'Goblin Boss' } })).toBe('boss-final');
    expect(baseNameFor('Orc', { fileName: { text: 'boss final', forName: 'Goblin Boss' } })).toBe('Orc');
  });

  it('gives batch tokens with the same name their own file names', () => {
    expect(uniqueFileNames(['Goblin', 'goblin', 'Goblin', 'Orc'], 'png')).toEqual(['Goblin.png', 'goblin-2.png', 'Goblin-3.png', 'Orc.png']);
  });
});

describe('batch ZIP', () => {
  it('holds one file per token, with its name and its exact bytes', () => {
    const names = uniqueFileNames(['Goblin 1', 'Goblin 2', 'Goblin 2'], 'png');
    const files = names.map((name, i) => ({ name, data: new Uint8Array([137, 80, 78, 71, i]) }));
    const unzipped = unzipSync(packZip(files));
    expect(Object.keys(unzipped)).toEqual(['Goblin-1.png', 'Goblin-2.png', 'Goblin-2-2.png']);
    expect([...unzipped['Goblin-2-2.png']!]).toEqual([137, 80, 78, 71, 2]);
  });
});

describe('animated export (not built yet)', () => {
  it('has the frame times ready for later', () => {
    expect(frameTimes({ fps: 4, seconds: 1 })).toEqual([0, 0.25, 0.5, 0.75]);
  });
});
