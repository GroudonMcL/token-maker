// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

// Checks the theme colours in tokens.css meet WCAG AA contrast (DESIGN.md §9).

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]!] = m[2]!;
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const themes = { dark: block(':root {'), light: block(":root[data-theme='light']") };

describe.each(Object.entries(themes))('%s theme contrast', (_name, t) => {
  const surfaces = ['bg', 'bg-top', 'surface', 'surface-raised'];
  it.each(surfaces)('body and muted text are readable on --%s', (s) => {
    expect(ratio(t.text!, t[s]!)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t['text-muted']!, t[s]!)).toBeGreaterThanOrEqual(4.5);
  });
  it('accent text is readable on panels', () => {
    expect(ratio(t.accent!, t.surface!)).toBeGreaterThanOrEqual(4.5);
  });
  it('text on accent buttons is readable', () => {
    expect(ratio(t['on-accent']!, t.accent!)).toBeGreaterThanOrEqual(4.5);
  });
  it('faint text and focus ring are visible (3:1 for large text and UI parts)', () => {
    expect(ratio(t['text-faint']!, t.surface!)).toBeGreaterThanOrEqual(3);
    expect(ratio(t.focus!, t.surface!)).toBeGreaterThanOrEqual(3);
  });
});
