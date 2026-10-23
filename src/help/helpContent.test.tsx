import { render } from '@testing-library/react';
import { App } from '../App';
import { EFFECTS } from '../document/defaults';
import { navigate } from '../hooks/useRoute';
import { SECTIONS } from '../layout/sections';
import { helpContent, type HelpEntry } from './helpContent';

/**
 * DESIGN.md §11: every control must have a help entry. These tests fail if
 * a control points at a help id that doesn't exist, or if a section,
 * toolbar button or other control is rendered without one.
 */
const known = new Set(Object.keys(helpContent));

describe('help content', () => {
  it('every entry has a title and one or two plain sentences', () => {
    for (const [id, entry] of Object.entries(helpContent)) {
      expect(entry.title.trim(), id).not.toBe('');
      const sentences = entry.text.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 0);
      expect(sentences.length, `${id} should be 1–2 sentences`).toBeGreaterThanOrEqual(1);
      expect(sentences.length, `${id} should be 1–2 sentences`).toBeLessThanOrEqual(2);
    }
  });

  it('every help picture exists in public/', () => {
    const files = import.meta.glob('../../public/help/*', { eager: true, query: '?url', import: 'default' });
    const have = new Set(Object.keys(files).map((f) => f.replace('../../public', '')));
    for (const [id, entry] of Object.entries(helpContent)) {
      const media = (entry as HelpEntry).media;
      if (media) expect(have.has(media.src), `${id}: ${media.src}`).toBe(true);
    }
  });

  it('every help tip has a before/after picture named after its id, with alt text (Phase 10)', () => {
    for (const [id, entry] of Object.entries(helpContent) as [string, HelpEntry][]) {
      expect(entry.media, id).toBeDefined();
      expect(entry.media!.src, id).toBe(`/help/${id.replace('.', '-')}.webp`);
      expect(entry.media!.alt.length, id).toBeGreaterThan(20);
    }
  });

  it('every effect has a help entry with a picture', () => {
    for (const e of EFFECTS) expect((helpContent as Record<string, HelpEntry>)[`effect.${e.kind}`]?.media, e.kind).toBeDefined();
  });

  it('every panel section has a help entry', () => {
    for (const s of SECTIONS) expect(known.has(s.helpId), s.id).toBe(true);
  });

  it('every help id used in the source code exists', () => {
    const files = import.meta.glob(['../**/*.tsx', '../**/*.ts', '!../**/*.test.*'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const used = new Set<string>();
    for (const src of Object.values(files)) {
      for (const m of src.matchAll(/(?:helpId|helpid|data-help-id|id)=["']([a-z]+\.[a-zA-Z.]+)["']/g)) used.add(m[1]!);
      for (const m of src.matchAll(/helpId:\s*'([a-z]+\.[a-zA-Z.]+)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(10);
    for (const id of used) expect(known.has(id), `missing help entry "${id}"`).toBe(true);
  });

  it.each(['/', '/kit'])('every control on %s has a valid help entry', (path) => {
    navigate(path);
    const { container } = render(<App />);
    const controls = container.querySelectorAll('[data-control]');
    expect(controls.length).toBeGreaterThan(5);
    controls.forEach((el) => {
      const id = el.getAttribute('data-help-id');
      expect(id, `${el.getAttribute('data-control')} has no data-help-id`).toBeTruthy();
      expect(known.has(id!), `unknown help id "${id}"`).toBe(true);
    });
    navigate('/');
  });
});
