// @vitest-environment node
// Frame Studio designs as frames (DESIGN.md §6.12). A design is drawn by
// Frame Studio's own renderer (src/frameStudio/) on Token Maker's band, so it
// must look exactly as it does in Frame Studio on a band of the same shape,
// thickness and spacing, at every token size.
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { createDocument } from '../document/defaults';
import { migrateDocument } from '../document/migrate';
import { computeInsets, outputSize } from '../document/sizing';
import type { TokenDocument } from '../document/types';
import { editableProject } from '../frameStudio/project/convert';
import { bandFillLayer, createProject, photoBand, repeatLayer, shapeLayer, textureLayer } from '../frameStudio/project/defaults';
import { pictureImage, setPictureDecoder } from '../frameStudio/render/pictures';
import { THEMED_TEMPLATES, themedProject } from '../frameStudio/project/themedTemplates';
import { setCanvasFactory as setFrameStudioCanvas } from '../frameStudio/render/canvas';
import { renderProject } from '../frameStudio/render/renderProject';
import { loadFrameDesignPictures, readFrameDesign, type FrameProject } from '../frameStudio/share/frameDesign';
import { setCanvasFactory } from '../image/processedArt';
import { SHAPES } from './catalog';
import type { Ctx } from './frameKit';
import { renderToken } from './render';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);
setFrameStudioCanvas(make);
// Frame Studio's icon ornaments are SVG paths and its photo textures JPEGs: node has neither Path2D nor a decoder.
(globalThis as { Path2D?: unknown }).Path2D ??= Path2D;
setPictureDecoder(async (url) => loadImage(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')));

const fixture = (name: string): FrameProject => {
  const r = readFrameDesign(readFileSync(`e2e/fixtures/designs/${name}.framestudio.json`, 'utf8'));
  if (!r.ok) throw new Error(r.error);
  return r.project;
};

/** A themed border from Frame Studio's template picker, as its saved file reads back. */
function themed(id: string): FrameProject {
  const r = readFrameDesign(JSON.parse(JSON.stringify(themedProject(THEMED_TEMPLATES.find((t) => t.id === id)!))));
  if (!r.ok) throw new Error(r.error);
  return r.project;
}

/** A token that is only its frame: no art, no backing, no shadows. */
function frameOnly(project: FrameProject, patch: (d: TokenDocument) => void = () => {}): TokenDocument {
  const doc = createDocument('Design');
  doc.frame = { ...doc.frame, kind: 'design', design: { id: 'd1', name: project.name, project }, backingOpacity: 0 };
  doc.shadows = { ...doc.shadows, outer: { ...doc.shadows.outer, enabled: false }, inner: { ...doc.shadows.inner, enabled: false } };
  patch(doc);
  return doc;
}

const pixels = (draw: (ctx: Ctx) => void, size: number) => {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d') as unknown as Ctx;
  draw(ctx);
  return ctx.getImageData(0, 0, size, size).data;
};

const inTokenMaker = (doc: TokenDocument, size = outputSize(doc.size.squares)) => pixels((ctx) => renderToken(ctx, doc, new Map(), size), size);

/** Frame Studio's own picture of the design, with its stage set to the token's band. */
function inFrameStudio(doc: TokenDocument, size = outputSize(doc.size.squares)) {
  const insets = computeInsets(doc);
  const p = doc.frame.design!.project;
  const stage = { ...p.stage, shape: doc.shape, showArt: false, outerSpacing: insets.frameOuter, thickness: insets.frameInner - insets.frameOuter };
  return pixels((ctx) => renderProject(ctx, { ...p, stage }, size), size);
}

const designs: [string, FrameProject][] = [
  ['Jewelled (a Phase 2 file)', fixture('jewelled')],
  ['Night sky (a Phase 3 file)', fixture('night-sky')],
  ['Paladin as editable layers, lit from the bottom right', { ...editableProject('paladin')!, stage: { ...editableProject('paladin')!.stage, light: 45 } }],
  ['Enamel and gold (a themed border with effects)', themed('enamel-gold')],
  ['Clockwork (a themed border with generators)', themed('clockwork')],
];

describe('Frame Studio designs as frames', () => {
  it.each(designs)('%s looks the same as in Frame Studio, on every shape', (_name, project) => {
    for (const s of SHAPES) {
      const doc = frameOnly(project, (d) => (d.shape = s.id));
      const a = inTokenMaker(doc);
      const b = inFrameStudio(doc);
      expect(a.every((v, i) => v === b[i]), s.id).toBe(true);
    }
  });

  it('every themed border opens and draws as in Frame Studio', () => {
    for (const t of THEMED_TEMPLATES) {
      const doc = frameOnly(themed(t.id));
      const a = inTokenMaker(doc, 128);
      const b = inFrameStudio(doc, 128);
      expect(a.some((v) => v !== 0), t.id).toBe(true);
      expect(a.every((v, i) => v === b[i]), t.id).toBe(true);
    }
  });

  it('a design with photo textures, icons, ornaments and paint fills looks the same once its photos have loaded', async () => {
    const gold = { kind: 'picture' as const, picture: 'gold' as const, scale: 3, angle: 0, bend: false, tint: null, lighting: 0.5 };
    const made = createProject([
      photoBand('castle-brick'),
      { ...textureLayer('veins'), where: 'everywhere' as const },
      { ...repeatLayer(), element: 'icon-dragon-head' as never, count: 8, size: 0.7, fillPaint: gold, paintEach: true },
      { ...shapeLayer(), shape: 'ornament' as const, element: 'fleur' as const, detail: '#5a3a10' },
      { ...bandFillLayer(), from: 0.9, to: 1, paint: { ...gold, bend: true } },
    ]);
    const r = readFrameDesign(JSON.parse(JSON.stringify(made)));
    if (!r.ok) throw new Error(r.error);
    expect(r.warnings).toEqual([]);
    await loadFrameDesignPictures(r.project);
    // The photos themselves, not their stand-in colours.
    for (const id of ['castle-brick', 'gold']) expect(pictureImage(id), id).not.toBeNull();
    for (const s of SHAPES) {
      const doc = frameOnly(r.project, (d) => (d.shape = s.id));
      const a = inTokenMaker(doc, 160);
      const b = inFrameStudio(doc, 160);
      expect(a.some((v) => v !== 0), s.id).toBe(true);
      expect(a.every((v, i) => v === b[i]), s.id).toBe(true);
    }
  });

  it('follows the token’s thickness and spacing, and its size', () => {
    const project = fixture('jewelled');
    for (const patch of [
      (d: TokenDocument) => (d.frame = { ...d.frame, thickness: 0.3, outerSpacing: 0.02 }),
      (d: TokenDocument) => (d.frame = { ...d.frame, innerSpacing: 0.1 }),
      (d: TokenDocument) => (d.size = { preset: 'large', squares: 2 }),
    ]) {
      const doc = frameOnly(project, patch);
      const size = 256;
      const a = inTokenMaker(doc, size);
      const b = inFrameStudio(doc, size);
      expect(a.every((v, i) => v === b[i])).toBe(true);
    }
    // A thicker band draws a different picture.
    const thick = inTokenMaker(frameOnly(project, (d) => (d.frame.thickness = 0.3)), 256);
    const usual = inTokenMaker(frameOnly(project), 256);
    expect(thick.some((v, i) => v !== usual[i])).toBe(true);
  });

  it('draws no frame when Frame Studio is picked but no design is opened yet', () => {
    const doc = frameOnly(fixture('jewelled'), (d) => (d.frame.design = null));
    expect(inTokenMaker(doc, 128).every((v) => v === 0)).toBe(true);
  });

  it('a design survives saving the token (autosave, presets) and is checked when read back', () => {
    const doc = frameOnly(fixture('night-sky'));
    const back = migrateDocument(JSON.parse(JSON.stringify(doc)));
    expect(back.frame.kind).toBe('design');
    expect(back.frame.design).toEqual(doc.frame.design);
    const a = inTokenMaker(back, 128);
    const b = inTokenMaker(doc, 128);
    expect(a.every((v, i) => v === b[i])).toBe(true);
  });
});
