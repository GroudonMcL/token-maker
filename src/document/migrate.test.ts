import { createDocument } from './defaults';
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
    expect(doc.schemaVersion).toBe(2);
    expect(doc.art.assetId).toBe('asset:1');
    expect(doc.art.transform.zoom).toBe(2);
    expect(doc.art.adjust).toEqual(createDocument().art.adjust);
    expect(doc.art.removal).toEqual({ enabled: false, color: null, intensity: 20, softness: 15 });
    expect(doc.art.strokes).toEqual([]);
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

  it('refuses documents from a newer version', () => {
    expect(() => migrateDocument({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(DocumentVersionError);
  });

  it('refuses a version with no migration', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, {}, 1)).toThrow(DocumentVersionError);
  });
});
