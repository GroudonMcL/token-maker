// Text layers (DESIGN.md §4.10): a line of letters standing on the band, or
// on a path or line layer it follows, each turned with the track. Runes are
// drawn from strokes (an Elder Futhark alphabet, the same everywhere); the
// other fonts are the ones Frame Studio ships (Grenze, Atkinson Hyperlegible),
// which the editor loads before drawing and the tests load from their files.

import type { FrameGeometry } from '../../render/frameKit';
import type { Point } from '../../render/shapes';
import type { TextFont, TextLayer } from '../project/types';
import { bandWidthPx } from './band';
import { context2d, newCanvas, type Ctx } from './canvas';
import { findNothing, pointAlong, trackLength, tracksFor, type FindLayer } from './track';

/** The CSS font of each shipped font, for a letter `px` pixels tall (its capitals). */
export const FONT_FAMILIES: Record<Exclude<TextFont, 'runes'>, { family: string; weight: number }> = {
  grenze: { family: 'Grenze', weight: 600 },
  atkinson: { family: 'Atkinson Hyperlegible', weight: 700 },
};
/** Capital height as a share of the font size. */
const CAP = 0.7;
export const fontCss = (font: Exclude<TextFont, 'runes'>, px: number) => `${FONT_FAMILIES[font].weight} ${px / CAP}px "${FONT_FAMILIES[font].family}"`;

type Glyph = number[][];
/**
 * Elder Futhark runes as strokes (polylines of x, y pairs), in a box 0.6 wide
 * and 1 tall centred on the origin, y down.
 */
const R: Record<string, Glyph> = {
  f: [[0, -0.5, 0, 0.5], [0, -0.15, 0.28, -0.45], [0, 0.12, 0.28, -0.18]],
  u: [[-0.24, 0.5, -0.24, -0.5, 0.24, -0.2, 0.24, 0.5]],
  th: [[0, -0.5, 0, 0.5], [0, -0.28, 0.26, 0, 0, 0.28]],
  a: [[0, -0.5, 0, 0.5], [0, -0.5, 0.26, -0.24], [0, -0.2, 0.26, 0.06]],
  r: [[-0.1, -0.5, -0.1, 0.5], [-0.1, -0.5, 0.2, -0.25, -0.1, 0, 0.22, 0.5]],
  k: [[0.2, -0.42, -0.2, -0.1, 0.2, 0.22]],
  g: [[-0.28, -0.5, 0.28, 0.5], [0.28, -0.5, -0.28, 0.5]],
  w: [[-0.1, -0.5, -0.1, 0.5], [-0.1, -0.5, 0.22, -0.25, -0.1, 0]],
  h: [[-0.22, -0.5, -0.22, 0.5], [0.22, -0.5, 0.22, 0.5], [-0.22, -0.18, 0.22, 0.18]],
  n: [[0, -0.5, 0, 0.5], [-0.2, -0.16, 0.2, 0.14]],
  i: [[0, -0.5, 0, 0.5]],
  j: [[-0.02, -0.42, -0.24, -0.16, -0.02, 0.1], [0.02, -0.1, 0.24, 0.16, 0.02, 0.42]],
  ei: [[0, -0.5, 0, 0.5], [0, -0.5, 0.2, -0.3], [0, 0.5, -0.2, 0.3]],
  p: [[-0.2, -0.5, -0.2, 0.5], [-0.2, -0.5, 0.14, -0.24, 0.24, -0.4], [-0.2, 0.5, 0.14, 0.24, 0.24, 0.4]],
  z: [[0, -0.5, 0, 0.5], [0, -0.12, -0.28, -0.46], [0, -0.12, 0.28, -0.46]],
  s: [[-0.2, -0.5, 0.16, -0.16, -0.16, 0.16, 0.2, 0.5]],
  t: [[0, -0.5, 0, 0.5], [0, -0.5, -0.27, -0.2], [0, -0.5, 0.27, -0.2]],
  b: [[-0.18, -0.5, -0.18, 0.5], [-0.18, -0.5, 0.2, -0.25, -0.18, 0, 0.2, 0.25, -0.18, 0.5]],
  e: [[-0.24, 0.5, -0.24, -0.5, 0, -0.16, 0.24, -0.5, 0.24, 0.5]],
  m: [[-0.24, -0.5, -0.24, 0.5], [0.24, -0.5, 0.24, 0.5], [-0.24, -0.5, 0.24, -0.08], [0.24, -0.5, -0.24, -0.08]],
  l: [[-0.08, -0.5, -0.08, 0.5], [-0.08, -0.5, 0.22, -0.2]],
  ng: [[0, -0.34, 0.24, 0, 0, 0.34, -0.24, 0, 0, -0.34]],
  o: [[-0.22, -0.2, 0, -0.5, 0.22, -0.2], [-0.22, -0.2, 0.26, 0.5], [0.22, -0.2, -0.26, 0.5]],
  d: [[-0.24, -0.5, -0.24, 0.5], [0.24, -0.5, 0.24, 0.5], [-0.24, -0.5, 0.24, 0.5], [0.24, -0.5, -0.24, 0.5]],
};

/** Which rune each letter is written with. */
const LETTER: Record<string, string> = {
  a: 'a', b: 'b', c: 'k', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h', i: 'i', j: 'j', k: 'k', l: 'l', m: 'm',
  n: 'n', o: 'o', p: 'p', q: 'k', r: 'r', s: 's', t: 't', u: 'u', v: 'w', w: 'w', x: 'z', y: 'ei', z: 'z',
};

/** The runes (or the word separator, ' ') a text is written in: "th" and "ng" have runes of their own. */
export function runesOf(text: string): string[] {
  const out: string[] = [];
  const t = text.toLowerCase();
  for (let i = 0; i < t.length; i++) {
    const two = t.slice(i, i + 2);
    if (two === 'th' || two === 'ng') {
      out.push(two);
      i++;
    } else if (LETTER[t[i]]) out.push(LETTER[t[i]]);
    else if (/\s/.test(t[i])) out.push(' ');
  }
  return out;
}

let measurer: Ctx | null = null;
const measureCtx = () => (measurer ??= context2d(newCanvas(4, 4)));

export interface PlacedGlyph {
  /** A character, a rune name, or ' ' (a rune word separator). */
  ch: string;
  p: Point;
  /** The letter's turn: its +x along the reading direction, its top towards −y. */
  angle: number;
  /** Its advance, in pixels. */
  width: number;
}

/** Where each letter of a text layer goes. */
export function textGlyphs(layer: TextLayer, g: FrameGeometry, find: FindLayer = findNothing): { glyphs: PlacedGlyph[]; height: number } {
  const height = layer.size * bandWidthPx(g);
  const [track] = tracksFor(layer.follow, layer.at, g, find);
  if (!track || height <= 0 || !layer.text) return { glyphs: [], height };
  const gap = layer.spacing * height;
  const chars = layer.font === 'runes' ? runesOf(layer.text) : [...layer.text];
  let widths: number[];
  if (layer.font === 'runes') widths = chars.map((c) => (c === ' ' ? 0.36 : 0.62) * height);
  else {
    const m = measureCtx();
    m.font = fontCss(layer.font, height);
    widths = chars.map((c) => m.measureText(c).width);
  }
  const total = widths.reduce((s, w) => s + w, 0) + gap * Math.max(0, chars.length - 1);
  const L = trackLength(track);
  const at = layer.along * L;
  const dir = layer.reverse ? -1 : 1;
  const start = layer.align === 'centre' ? at - (dir * total) / 2 : at;
  const glyphs: PlacedGlyph[] = [];
  let x = 0;
  chars.forEach((ch, i) => {
    const mid = start + dir * (x + widths[i] / 2);
    x += widths[i] + gap;
    // A closed track wraps; text longer than the way round would overlap itself, so it stops.
    if (track.closed && x - gap > L + 1) return;
    const p = pointAlong(track, mid);
    if (!p) return;
    glyphs.push({ ch, p: { x: p.x, y: p.y }, angle: p.angle + (layer.reverse ? Math.PI : 0), width: widths[i] });
  });
  return { glyphs, height };
}

function runeStrokes(ctx: Ctx, ch: string, h: number): void {
  ctx.beginPath();
  if (ch === ' ') {
    // The word separator: two dots.
    for (const y of [-0.18, 0.18]) {
      ctx.moveTo(0.001, y * h);
      ctx.lineTo(0, y * h);
    }
    return;
  }
  for (const line of R[ch] ?? []) {
    for (let k = 0; k < line.length; k += 2) (k ? ctx.lineTo : ctx.moveTo).call(ctx, line[k] * h, line[k + 1] * h);
  }
}

/** Draws a text layer, letter by letter along its track. */
export function drawText(ctx: Ctx, layer: TextLayer, g: FrameGeometry, _light: number, find: FindLayer = findNothing): void {
  const { glyphs, height: h } = textGlyphs(layer, g, find);
  if (glyphs.length === 0) return;
  const line = Math.max(1, h * 0.11);
  const outline = layer.outline && layer.outlineWidth > 0 ? Math.max(0.5, h * layer.outlineWidth) : 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (layer.font !== 'runes') {
    ctx.font = fontCss(layer.font, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
  }
  // Outlines under every letter first, so neighbours don't cover each other's.
  for (const pass of outline ? ['outline', 'fill'] : ['fill']) {
    for (const { ch, p, angle } of glyphs) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      if (layer.font === 'runes') {
        runeStrokes(ctx, ch, h);
        ctx.strokeStyle = pass === 'outline' ? layer.outline! : layer.fill;
        ctx.lineWidth = pass === 'outline' ? line + outline * 2 : line;
        ctx.stroke();
      } else if (pass === 'outline') {
        ctx.strokeStyle = layer.outline!;
        ctx.lineWidth = outline * 2;
        ctx.strokeText(ch, 0, h / 2);
      } else {
        ctx.fillStyle = layer.fill;
        ctx.fillText(ch, 0, h / 2);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}
