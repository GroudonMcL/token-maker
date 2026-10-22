import { createDocument, MAX_EFFECTS, newEffect } from './defaults';
import { DocumentVersionError, migrateDocument } from './migrate';
import { SCHEMA_VERSION } from './types';

describe('migrateDocument', () => {
  it('keeps a current document unchanged', () => {
    const doc = createDocument('Goblin');
    doc.art.assetId = 'asset:1';
    expect(migrateDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('fills in missing fields and fixes invalid ones', () => {
    const doc = migrateDocument({
      schemaVersion: SCHEMA_VERSION,
      name: 'Orc',
      shape: 'triangle',
      size: { preset: 'large', squares: 99 },
      frame: { style: 'not-a-frame', color: 'red', thickness: -5 },
    });
    expect(doc.name).toBe('Orc');
    expect(doc.shape).toBe('circle');
    expect(doc.size).toEqual({ preset: 'large', squares: 2 }); // preset wins over a bad number
    expect(doc.frame.style).toBe('stamped');
    expect(doc.frame.color).toBe('#d7671f');
    expect(doc.frame.thickness).toBe(0);
    expect(doc.shadows.inner.enabled).toBe(true);
  });

  it('drops frame opacity, unlocks the art and checks the highlights colour', () => {
    const base = createDocument();
    const old = { ...base, art: { ...base.art, transform: { ...base.art.transform, lockFill: true } }, frame: { ...base.frame, opacity: 0.5 } };
    const doc = migrateDocument(JSON.parse(JSON.stringify(old)));
    expect(doc.frame).not.toHaveProperty('opacity');
    expect(doc.art.transform.lockFill).toBe(false);
    expect(doc.frame.highlightColor).toBeNull();
    expect(migrateDocument({ ...base, frame: { ...base.frame, highlightColor: '#AABBCC' } }).frame.highlightColor).toBe('#aabbcc');
    expect(migrateDocument({ ...base, frame: { ...base.frame, highlightColor: 'green' } }).frame.highlightColor).toBeNull();
  });

  it('clamps custom sizes', () => {
    expect(migrateDocument({ schemaVersion: 1, size: { preset: 'custom', squares: 50 } }).size.squares).toBe(10);
    expect(migrateDocument({ schemaVersion: 1, size: { preset: 'custom', squares: 0.1 } }).size.squares).toBe(0.5);
  });

  it('returns a fresh document for rubbish', () => {
    expect(migrateDocument(null)).toEqual(createDocument());
    expect(migrateDocument('hello')).toEqual(createDocument());
  });

  it('runs each migration step in order', () => {
    const steps = {
      0: (d: Record<string, unknown>) => ({ ...d, name: `${d.title as string} (v1)` }),
      1: (d: Record<string, unknown>) => ({ ...d, name: `${d.name as string} (v2)` }),
    };
    const doc = migrateDocument({ title: 'Old' }, steps, 2);
    expect(doc.name).toBe('Old (v1) (v2)');
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('upgrades a version 1 document, starting the image edits at their defaults', () => {
    const v1 = { schemaVersion: 1, name: 'Old goblin', art: { assetId: 'asset:1', transform: { zoom: 2 } } };
    const doc = migrateDocument(v1);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.art.assetId).toBe('asset:1');
    expect(doc.art.transform.zoom).toBe(2);
    expect(doc.art.adjust).toEqual(createDocument().art.adjust);
    expect(doc.art.removal).toEqual({ enabled: false, color: null, intensity: 20, softness: 15 });
    expect(doc.art.strokes).toEqual([]);
  });

  it('upgrades a version 2 document: keeps the light direction, starts background, overlays and lighting at their defaults', () => {
    const v2 = { schemaVersion: 2, background: { kind: 'none' }, foreground: [], lighting: { direction: 300 } };
    const doc = migrateDocument(v2);
    expect(doc.lighting).toEqual({ ...createDocument().lighting, direction: 300 });
    expect(doc.background).toEqual(createDocument().background);
    expect(doc.foreground).toEqual([]);
  });

  it('checks backgrounds, overlays and lighting', () => {
    const doc = migrateDocument({
      schemaVersion: SCHEMA_VERSION,
      background: { kind: 'image', image: { type: 'library', id: 'forest' }, blur: 500, zoom: 0, gradient: { stops: [{ offset: 2, color: 'red' }] } },
      foreground: [{ kind: 'vignette', blend: 'darken', opacity: 2, id: 'v' }, { kind: 'lasers' }, 'junk'],
      lighting: { enabled: true, preset: 'disco', strength: 300, rim: { enabled: true } },
    });
    expect(doc.background.kind).toBe('image');
    expect(doc.background.image).toEqual({ type: 'library', id: 'forest' });
    expect(doc.background.blur).toBe(100);
    expect(doc.background.zoom).toBe(0.2);
    expect(doc.background.gradient.stops.length).toBeGreaterThanOrEqual(2); // one stop isn't a gradient: defaults used
    expect(doc.foreground).toHaveLength(2);
    expect(doc.foreground[0]).toMatchObject({ id: 'v', kind: 'vignette', blend: 'multiply', opacity: 1 });
    expect(doc.foreground[1]!.kind).toBe('vignette'); // unknown kinds become a vignette rather than vanishing
    expect(doc.lighting).toMatchObject({ enabled: true, preset: null, strength: 100, rim: { enabled: true, strength: 60, width: 30 } });
  });

  it('checks image edits and brush strokes', () => {
    const doc = migrateDocument({
      schemaVersion: SCHEMA_VERSION,
      art: {
        adjust: { brightness: 500, hue: -400, blur: -3, invert: 'yes', sepia: 40 },
        removal: { enabled: true, color: 'green', intensity: 30 },
        strokes: [
          { mode: 'restore', size: 0.1, softness: 0.2, points: [0.5, 0.5, 1, 0.6, 0.6, 1, 0.7] },
          { mode: 'paint', points: [0.1, 0.1, 1] },
          { points: 'nope' },
        ],
      },
    });
    expect(doc.art.adjust).toMatchObject({ brightness: 100, hue: -180, blur: 0, invert: false, sepia: 40 });
    expect(doc.art.removal).toEqual({ enabled: true, color: null, intensity: 30, softness: 15 });
    expect(doc.art.strokes).toEqual([
      { mode: 'restore', size: 0.1, softness: 0.2, points: [0.5, 0.5, 1, 0.6, 0.6, 1] },
      { mode: 'erase', size: 0.05, softness: 0.5, points: [0.1, 0.1, 1] },
    ]);
  });

  it('upgrades a version 3 document: the pop-out starts on with an empty mask', () => {
    const v3 = { schemaVersion: 3, art: { assetId: 'asset:x', strokes: [{ mode: 'erase', size: 0.1, softness: 0, points: [0.5, 0.5, 1] }] } };
    const doc = migrateDocument(v3);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.art.assetId).toBe('asset:x');
    expect(doc.art.strokes).toHaveLength(1);
    expect(doc.art.popOut).toEqual({ enabled: true, strokes: [] });
  });

  it('checks pop-out strokes and shadows', () => {
    const doc = migrateDocument({
      schemaVersion: SCHEMA_VERSION,
      art: {
        popOut: {
          enabled: false,
          strokes: [
            { mode: 'erase', size: 0.1, softness: 0.2, points: [0.5, 0.5, 1] },
            { mode: 'restore', points: [0.1, 0.1, 1] },
            { points: null },
          ],
        },
      },
      shadows: { popOut: { enabled: false, followLight: false, angle: 30, distance: 9, opacity: -1, color: 'red' } },
    });
    expect(doc.art.popOut).toEqual({
      enabled: false,
      strokes: [
        { mode: 'erase', size: 0.1, softness: 0.2, points: [0.5, 0.5, 1] },
        { mode: 'add', size: 0.05, softness: 0.5, points: [0.1, 0.1, 1] },
      ],
    });
    expect(doc.shadows.popOut).toMatchObject({ enabled: false, followLight: false, angle: 30, distance: 1, opacity: 0, color: '#000000' });
  });

  it('upgrades a version 4 document: old placeholder effects are dropped', () => {
    const doc = migrateDocument({ schemaVersion: 4, name: 'Old', effects: [{ id: 'x', kind: 'fire', placement: 'over' }] });
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.name).toBe('Old');
    expect(doc.effects).toEqual([]);
  });

  it('checks every effect, dropping unknown kinds and keeping the order', () => {
    const doc = migrateDocument({
      schemaVersion: SCHEMA_VERSION,
      effects: [
        { id: 'a', kind: 'frost', placement: 'border', intensity: 140, color: 'blue', size: 9, spread: -5, seed: 7.4, visible: false },
        { id: 'b', kind: 'dragonfire' },
        { kind: 'mist', placement: 'sideways' },
        'nope',
        ...Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, kind: 'embers' })),
      ],
    });
    expect(doc.effects).toHaveLength(MAX_EFFECTS);
    expect(doc.effects[0]).toEqual({ id: 'a', kind: 'frost', placement: 'border', intensity: 100, color: '#bfe8ff', size: 1, spread: 0, seed: 7, visible: false });
    expect(doc.effects[1]).toMatchObject({ kind: 'mist', placement: newEffect('mist').placement, visible: true });
    expect(doc.effects[1]!.id).toMatch(/^effect-/);
  });

  it('refuses documents from a newer version', () => {
    expect(() => migrateDocument({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(DocumentVersionError);
  });

  it('refuses a version with no migration', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, {}, 1)).toThrow(DocumentVersionError);
  });
});
