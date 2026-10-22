// @vitest-environment node
// Presets (DESIGN.md §6.9): save → export → import round trips through a
// file and a text code, old presets migrate, and the art never travels.
import { createDocument, newDecoration, newEffect, newLabel } from '../document/defaults';
import { SCHEMA_VERSION, type TokenDocument } from '../document/types';
import { BUILT_IN_PRESETS } from './builtins';
import {
  applyLook,
  createPreset,
  lookFromDoc,
  migratePreset,
  PRESET_SCHEMA_VERSION,
  PresetError,
  presetFileName,
  presetFromText,
  presetToCode,
  presetToJson,
  previewDocument,
} from './preset';

/** A token with a look worth saving, and art of its own. */
function styled(): TokenDocument {
  const d = createDocument('Goblin boss');
  d.art.assetId = 'asset:goblin';
  d.art.adjust.brightness = 20;
  d.art.popOut.strokes = [{ mode: 'add', size: 0.1, softness: 0.5, points: [0.5, 0.5, 1] }];
  d.size = { preset: 'large', squares: 2 };
  d.shape = 'hexagon';
  d.frame = {
    ...d.frame,
    kind: 'image',
    image: { source: { type: 'upload', id: 'my-ring' }, name: 'My ring', hole: [0.7, 0, 0, 0.7, -0.7, 0, 0, -0.7], outer: 0.96, nudge: { x: 0.02, y: 0, scale: 1.1 } },
  };
  d.decorations = [{ ...newDecoration('horn', 'h1'), mirror: true }];
  d.effects = [newEffect('frost', 'e1')];
  d.lighting = { ...d.lighting, enabled: true, rim: { enabled: true, strength: 80, width: 40, softness: 70 } };
  d.background = { ...d.background, kind: 'image', image: { type: 'asset', assetId: 'asset:my-forest' } };
  return d;
}

describe('presets', () => {
  it('never carries the art, its edits, the name or the size', () => {
    const p = createPreset(styled(), '  Big   boss ');
    expect(p.name).toBe('Big boss');
    expect(p.schemaVersion).toBe(PRESET_SCHEMA_VERSION);
    expect(p.docVersion).toBe(SCHEMA_VERSION);
    const json = presetToJson(p);
    for (const word of ['asset:goblin', 'brightness', '"strokes"', 'Goblin boss', 'squares', 'asset:my-forest']) expect(json).not.toContain(word);
    // A background picture of the user's own is theirs too: it is left out.
    expect(p.look.background.kind).toBe('none');
    expect(p.look.background.image).toBeNull();
  });

  it('save → file → import gives the same look back', async () => {
    const p = createPreset(styled(), 'Boss look');
    const back = await presetFromText(presetToJson(p));
    expect(back).toEqual(p);
    expect(presetFileName(p)).toBe('boss-look.tokenpreset.json');
  });

  it('save → text code → import gives the same look back, and the code is compact', async () => {
    const p = createPreset(styled(), 'Boss look');
    const code = await presetToCode(p);
    expect(code).toMatch(/^TKP1\.[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(presetToJson(p).length / 2);
    expect(await presetFromText(code)).toEqual(p);
    // Line breaks and spaces picked up while copying don't matter.
    expect(await presetFromText(`  ${code.slice(0, 40)}\n${code.slice(40)}  `)).toEqual(p);
  });

  it('reads plain (uncompressed) codes too', async () => {
    const p = createPreset(styled(), 'Plain');
    const plain = `TKP0.${Buffer.from(JSON.stringify(p)).toString('base64url')}`;
    expect(await presetFromText(plain)).toEqual(p);
  });

  it('keeps the pictures of uploaded frames when shared', async () => {
    const p = { ...createPreset(styled(), 'Ring'), images: { 'my-ring': 'data:image/png;base64,iVBORw0KGgo=', bad: 'javascript:alert(1)' } };
    const back = await presetFromText(await presetToCode(p));
    expect(back.images).toEqual({ 'my-ring': 'data:image/png;base64,iVBORw0KGgo=' });
  });

  it('applying a preset changes the look but keeps the art, name, size and the user’s own background picture', () => {
    const p = createPreset(styled(), 'Boss look');
    const target = createDocument('Orc');
    target.art.assetId = 'asset:orc';
    target.art.adjust.contrast = 30;
    target.size = { preset: 'huge', squares: 3 };
    target.background = { ...target.background, kind: 'image', image: { type: 'asset', assetId: 'asset:cave' } };
    const out = applyLook(target, p.look);
    expect(out.name).toBe('Orc');
    expect(out.art).toEqual(target.art);
    expect(out.size).toEqual(target.size);
    expect(out.shape).toBe('hexagon');
    expect(out.frame).toEqual(p.look.frame);
    expect(out.decorations).toEqual(p.look.decorations);
    expect(out.lighting.rim.softness).toBe(70);
    expect(out.background.image).toEqual({ type: 'asset', assetId: 'asset:cave' });
    // Changing the result never changes the preset.
    out.decorations[0]!.size = 9;
    expect(p.look.decorations[0]!.size).not.toBe(9);
  });

  it('carries the label’s style but never its words', () => {
    const d = styled();
    d.label = { ...newLabel(), shape: 'ring', text: 'Grukk the Mighty', font: 'pirata-one' };
    const p = createPreset(d, 'Ring name');
    expect(p.look.label).toMatchObject({ shape: 'ring', font: 'pirata-one', text: null });
    expect(presetToJson(p)).not.toContain('Grukk');
    // Applied to a token with its own label words, the words stay; otherwise it shows that token's name.
    const other = createDocument('Kobold');
    expect(applyLook({ ...other, label: { ...newLabel(), text: 'Sneaky' } }, p.look).label).toMatchObject({ shape: 'ring', text: 'Sneaky' });
    expect(applyLook(other, p.look).label).toMatchObject({ shape: 'ring', text: null });
    // A look without a label removes it.
    expect(applyLook({ ...other, label: newLabel() }, lookFromDoc(createDocument())).label).toBeNull();
  });

  it('keeps an uploaded label font when shared, and drops anything that isn’t a font file', () => {
    const d = styled();
    d.label = { ...newLabel(), font: 'upload:f1' };
    const p = migratePreset({
      ...createPreset(d, 'Own font'),
      fonts: { f1: { name: 'My Runes', data: 'data:font/woff2;base64,AAAA' }, f2: { name: 'Evil', data: 'javascript:alert(1)' }, f3: 'data:font/ttf;base64,AA' },
    });
    expect(p.fonts).toEqual({ f1: { name: 'My Runes', data: 'data:font/woff2;base64,AAAA' } });
    expect(p.look.label?.font).toBe('upload:f1');
  });

  it('migrates an old preset saved from a version 5 token (before rim softness and decorations)', async () => {
    const v5Look = lookFromDoc(createDocument()) as unknown as Record<string, unknown>;
    const lighting = { ...(v5Look.lighting as Record<string, unknown>), enabled: true, rim: { enabled: true, strength: 50, width: 20 } };
    const frame: Record<string, unknown> = { ...(v5Look.frame as Record<string, unknown>), kind: 'code' };
    delete frame.image;
    const old = { schemaVersion: 1, docVersion: 5, id: 'preset:old', name: 'Old moon', look: { ...v5Look, lighting, frame, decorations: [{ id: 'x', kind: 'gem' }] } };
    const p = await presetFromText(JSON.stringify(old));
    expect(p.docVersion).toBe(SCHEMA_VERSION);
    expect(p.look.lighting.rim).toEqual({ enabled: true, strength: 50, width: 20, softness: 0 }); // crisp, as it was
    expect(p.look.decorations).toEqual([]);
    expect(p.look.frame.image).toBeNull();
    expect(p.name).toBe('Old moon');
  });

  it('migrates a version 0 preset (a bare look with a name)', () => {
    const look = lookFromDoc({ ...createDocument(), shape: 'square' });
    const p = migratePreset({ ...look, name: 'Bare', schemaVersion: 5 });
    expect(p.look.shape).toBe('square');
    expect(p.name).toBe('Bare');
    expect(p.schemaVersion).toBe(PRESET_SCHEMA_VERSION);
  });

  it('refuses things that are not presets, damaged codes and newer versions, with friendly messages', async () => {
    await expect(presetFromText('hello')).rejects.toThrow(PresetError);
    await expect(presetFromText('{ not json')).rejects.toThrow(/couldn't be read/);
    await expect(presetFromText('TKP1.AAAA')).rejects.toThrow(/damaged/);
    await expect(presetFromText('TKP9.AAAA')).rejects.toThrow(/newer version/);
    const p = createPreset(createDocument(), 'Future');
    await expect(presetFromText(JSON.stringify({ ...p, schemaVersion: 99 }))).rejects.toThrow(/newer version/);
    await expect(presetFromText(JSON.stringify({ ...p, docVersion: 99 }))).rejects.toThrow(/newer version/);
    expect(() => migratePreset([1, 2])).toThrow(PresetError);
  });

  it('cleans up a damaged look instead of breaking the editor', () => {
    const p = migratePreset({ schemaVersion: 1, docVersion: SCHEMA_VERSION, name: 'Odd', look: { shape: 'triangle', frame: { style: 'nope' }, effects: 'lots' } });
    expect(p.look.shape).toBe('circle');
    expect(p.look.frame.style).toBe('stamped');
    expect(p.look.effects).toEqual([]);
  });

  it('has the eight built-in presets from the design, each a valid preset', async () => {
    expect(BUILT_IN_PRESETS.map((p) => p.name)).toEqual(['Boss', 'Undead', 'Party member', 'Minion', 'Fey', 'Fiend', 'Celestial', 'Construct']);
    for (const p of BUILT_IN_PRESETS) {
      expect(migratePreset(JSON.parse(presetToJson(p)))).toEqual(p);
      expect(await presetFromText(await presetToCode(p))).toEqual(p);
      expect(previewDocument(p).art.assetId).toBeNull();
    }
    // They really differ from each other.
    expect(new Set(BUILT_IN_PRESETS.map((p) => JSON.stringify(p.look))).size).toBe(8);
  });
});
