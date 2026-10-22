import { createDocument, MAX_DECORATIONS, MAX_EFFECTS, newDecoration, newEffect, newLabel } from './defaults';
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
    // Old rims were crisp, so they keep softness 0 (Phase 7).
    const base = createDocument().lighting;
    expect(doc.lighting).toEqual({ ...base, direction: 300, rim: { ...base.rim, softness: 0 } });
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

  it('upgrades a version 5 document: crisp rims stay crisp, placeholder decorations go, the frame is drawn', () => {
    const base = createDocument();
    const v5 = {
      ...JSON.parse(JSON.stringify(base)),
      schemaVersion: 5,
      lighting: { ...base.lighting, rim: { enabled: true, strength: 70, width: 30 } },
      decorations: [{ id: 'x', kind: 'gem' }],
      frame: { ...base.frame, kind: 'code' },
    };
    delete v5.frame.image;
    const doc = migrateDocument(v5);
    expect(doc.lighting.rim).toEqual({ enabled: true, strength: 70, width: 30, softness: 0 });
    expect(doc.decorations).toEqual([]);
    expect(doc.frame.kind).toBe('code');
    expect(doc.frame.image).toBeNull();
    // A new token's rim starts soft.
    expect(base.lighting.rim.softness).toBeGreaterThan(0);
  });

  it('checks decorations and picture frames', () => {
    const base = createDocument();
    const hole = [0.7, 0, 0, 0.7, -0.7, 0, 0, -0.7];
    const doc = migrateDocument({
      ...base,
      decorations: [
        { id: 'a', kind: 'horn', place: 'topRight', mirror: true, size: 99, opacity: 3, color: 'red' },
        { id: 'b', kind: 'laser-sword' },
        { id: 'c', kind: 'gem', place: 'middle', x: 9, y: -9 },
        'junk',
      ],
      frame: { ...base.frame, kind: 'image', image: { source: { type: 'upload', id: 'f1' }, name: 'Ring', hole, outer: 0.95, nudge: { x: 2, y: 0, scale: 9 } } },
    });
    expect(doc.decorations.map((d) => d.kind)).toEqual(['horn', 'gem']);
    expect(doc.decorations[0]).toMatchObject({ place: 'topRight', mirror: true, size: 4, opacity: 1, color: newDecoration('horn').color });
    expect(doc.decorations[1]).toMatchObject({ place: 'top', x: 1.5, y: -1.5 }); // bad snap point → the gem's default
    expect(doc.frame.kind).toBe('image');
    expect(doc.frame.image).toEqual({ source: { type: 'upload', id: 'f1' }, name: 'Ring', hole, outer: 0.95, nudge: { x: 0.5, y: 0, scale: 1.5 } });
    // A picture frame without a usable hole falls back to the drawn frame.
    const broken = migrateDocument({ ...base, frame: { ...base.frame, kind: 'image', image: { source: { type: 'library', id: 'rope' }, hole: [1, 2] } } });
    expect(broken.frame.kind).toBe('code');
    expect(broken.frame.image).toBeNull();
    expect(migrateDocument({ ...base, decorations: Array.from({ length: 40 }, (_, i) => newDecoration('star', `s${i}`)) }).decorations).toHaveLength(MAX_DECORATIONS);
  });
  it('upgrades a version 6 document: the old label placeholder is dropped', () => {
    const v6 = { ...JSON.parse(JSON.stringify(createDocument('Orc'))), schemaVersion: 6, label: { text: 'Orc' } };
    const doc = migrateDocument(v6);
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
    expect(doc.label).toBeNull();
  });

  it('keeps a label and checks every field', () => {
    const base = createDocument('Orc');
    const label = { ...newLabel(), shape: 'ring' as const, text: 'Grukk', place: 'free' as const, angle: 30, font: 'upload:abc-123', italic: true };
    expect(migrateDocument(JSON.parse(JSON.stringify({ ...base, label }))).label).toEqual(label);
    const bad = migrateDocument({
      ...base,
      label: {
        shape: 'scroll',
        text: 42,
        place: 'left',
        size: 99,
        width: -1,
        curve: 500,
        font: '"><script>',
        color: 'red',
        opacity: 2,
        outline: { width: 9, color: '#ABCDEF' },
        shadow: { enabled: 'yes', blur: 5 },
        letterSpacing: 3,
        align: 'justify',
      },
    }).label!;
    const d = newLabel();
    expect(bad).toMatchObject({ shape: d.shape, text: null, place: d.place, size: 2, width: 0.1, curve: 100, font: d.font, color: d.color, opacity: 1, letterSpacing: 0.5, align: d.align });
    expect(bad.outline).toEqual({ width: 0.2, color: '#abcdef' });
    expect(bad.shadow).toEqual({ ...d.shadow, blur: 0.5 });
    expect(migrateDocument({ ...base, label: 'Orc' }).label).toBeNull();
  });
});
