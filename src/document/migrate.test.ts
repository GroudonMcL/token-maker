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

  it('refuses documents from a newer version', () => {
    expect(() => migrateDocument({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(DocumentVersionError);
  });

  it('refuses a version with no migration', () => {
    expect(() => migrateDocument({ schemaVersion: 0 }, {}, 1)).toThrow(DocumentVersionError);
  });
});
