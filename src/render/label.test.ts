// @vitest-environment node
// The label (DESIGN.md §6.10): pixel checks of layer 14 drawn with
// @napi-rs/canvas and the site's own font files, curved text following the
// ring on every shape, shrink-to-fit, per-square sizes and snapping.
import { createCanvas } from '@napi-rs/canvas';
import { registerBundledFonts } from '../../scripts/nodeFonts';
import { createDocument, newLabel, RING_TEXT_STYLE } from '../document/defaults';
import type { LabelSettings, TokenDocument } from '../document/types';
import { draggedLabel } from '../editor/labelActions';
import { circleHole } from '../image/frameHole';
import { setCanvasFactory } from '../image/processedArt';
import { SHAPES } from './catalog';
import { decorationGeometry } from './decorations';
import type { Ctx } from './frameKit';
import { labelPlacement, labelText, layoutLabel, splitLetters, type LabelLayout } from './label';
import { renderToken } from './render';
import { pointInPolygon } from './shapes';

const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
setCanvasFactory(make);
registerBundledFonts();
const measure = createCanvas(1, 1).getContext('2d') as unknown as Ctx;

/** A token with no art or drop shadow, so the label's pixels are easy to find. */
function tokenWith(label: Partial<LabelSettings>, patch: Partial<TokenDocument> = {}): TokenDocument {
  const d = { ...createDocument('Goblin Boss'), ...patch };
  d.shadows = { ...d.shadows, outer: { ...d.shadows.outer, enabled: false } };
  d.label = { ...newLabel(), ...label };
  return d;
}

function draw(doc: TokenDocument, size = 256) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  renderToken(ctx as unknown as Ctx, doc, new Map(), size);
  return ctx.getImageData(0, 0, size, size).data;
}

/** How many pixels differ by more than a little between two renders. */
function changed(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) + Math.abs(a[i + 3]! - b[i + 3]!) > 24) n++;
  }
  return n;
}

/** Pixels close to an exact colour (the text, drawn in a colour nothing else uses). */
function pixelsOf(data: Uint8ClampedArray, size: number, [r, g, b]: [number, number, number]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! > 200 && Math.abs(data[i]! - r) < 12 && Math.abs(data[i + 1]! - g) < 12 && Math.abs(data[i + 2]! - b) < 12) {
      out.push({ x: (i / 4) % size, y: Math.floor(i / 4 / size) });
    }
  }
  return out;
}

const GREEN: [number, number, number] = [0, 255, 0];

describe('label text', () => {
  it('shows the token name unless it has its own words', () => {
    const doc = tokenWith({});
    expect(labelText(doc)).toBe('Goblin Boss');
    expect(labelText({ ...doc, label: { ...doc.label!, text: '  The   King ' } })).toBe('The King');
  });

  it('keeps accented letters and emoji whole', () => {
    expect(splitLetters('Zoë👑')).toEqual(['Z', 'o', 'ë', '👑']);
  });

  it('draws nothing without a label or without words', () => {
    const plain = tokenWith({});
    plain.label = null;
    expect(changed(draw(plain), draw({ ...plain, label: { ...newLabel(), text: '   ' }, name: '' }))).toBe(0);
  });
});

describe('the export uses the chosen font', () => {
  const doc = (font: string) => tokenWith({ font, shape: 'box', color: '#00ff00', size: 0.3, text: 'Wyrmling', bold: false });

  it('draws the label in the bundled font, not a fallback', () => {
    const pirata = draw(doc('pirata-one'));
    // A font this browser doesn't have falls back to the default serif.
    const fallback = draw(doc('upload:not-saved-here'));
    const cinzel = draw(doc('cinzel'));
    expect(changed(pirata, fallback)).toBeGreaterThan(150);
    expect(changed(pirata, cinzel)).toBeGreaterThan(150);
    expect(changed(cinzel, fallback)).toBeGreaterThan(150);
  });

  it('matches the font measured on its own', () => {
    // The text's width on the label is the font's own width for these letters.
    const d = doc('uncial-antiqua');
    d.label = { ...d.label!, letterSpacing: 0, size: 0.24, width: 2.4 };
    const l = layoutLabel(measure, d, 128)!;
    expect(l.fontPx).toBeCloseTo(0.24 * 128, 6); // it fits, so it isn't shrunk
    measure.font = `400 ${l.fontPx}px "tm-uncial-antiqua"`;
    expect(l.natural).toBeCloseTo(measure.measureText('Wyrmling').width, 0);
    const pixels = pixelsOf(draw(d), 256, GREEN);
    const xs = pixels.map((p) => p.x);
    // The inked letters span about the measured width, centred on the token.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(l.natural * 0.8);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(l.natural * 1.1);
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(128, -1);
  });

  it('bold and italic change the letters', () => {
    const base = draw(doc('spectral'));
    expect(changed(base, draw({ ...doc('spectral'), label: { ...doc('spectral').label!, bold: true } }))).toBeGreaterThan(100);
    expect(changed(base, draw({ ...doc('spectral'), label: { ...doc('spectral').label!, italic: true } }))).toBeGreaterThan(100);
  });

  it('every shape, outline, shadow and spacing draws the same pixels twice', () => {
    for (const shape of ['banner', 'plaque', 'pill', 'box', 'ring'] as const) {
      const d = tokenWith({ shape, textOutline: { width: 0.02, color: '#000000' }, shadow: { enabled: true, color: '#000000', opacity: 0.6, blur: 0.04 }, letterSpacing: 0.1 });
      expect(changed(draw(d), draw(d)), shape).toBe(0);
    }
  });
});

describe('curved text', () => {
  const R = 128;
  /** Where each letter's middle is on its line (undoing the lift that centres capitals on the line). */
  const onLine = (l: LabelLayout) =>
    l.glyphs!.map((g) => {
      const rise = (l.fontPx * 0.7) / 2; // close enough to any font's capital height to compare radii
      return { x: g.x + Math.sin(g.rotation) * rise, y: g.y - Math.cos(g.rotation) * rise, rotation: g.rotation };
    });

  it.each(SHAPES.map((s) => s.id))('ring text follows the middle of the frame band on a %s token', (shape) => {
    for (const place of ['bottom', 'top'] as const) {
      const doc = tokenWith({ shape: 'ring', place, text: 'The Dread Necromancer', shrinkToFit: true }, { shape });
      const geo = decorationGeometry(doc);
      const l = layoutLabel(measure, doc, R)!;
      const pts = onLine(l);
      expect(pts.length).toBe(21);
      for (const p of pts) {
        const deg = (Math.atan2(p.y, p.x) * 180) / Math.PI;
        // Within a few pixels of the band's middle line, wherever the shape's edge is.
        expect(Math.abs(Math.hypot(p.x, p.y) - geo.ringAt(deg) * R)).toBeLessThan(l.fontPx * 0.45);
      }
      // Reads left to right, and upright: at the bottom the tops of the letters point inwards.
      for (let i = 1; i < pts.length; i++) expect(pts[i]!.x).toBeGreaterThan(pts[i - 1]!.x - 2);
      const middle = pts[Math.floor(pts.length / 2)]!;
      // (A hexagon's corner can sit right under the middle letter.)
      expect(Math.abs(middle.rotation)).toBeLessThan(0.6);
      expect(Math.sign(middle.y)).toBe(place === 'bottom' ? 1 : -1);
    }
  });

  it('ring text follows a picture frame’s hole', () => {
    const doc = tokenWith({ shape: 'ring' });
    doc.frame = { ...doc.frame, kind: 'image', image: { source: { type: 'library', id: 'x' }, name: 'Ring', hole: circleHole(0.6), outer: 0.95, nudge: { x: 0, y: 0, scale: 1 } } };
    const l = layoutLabel(measure, doc, R)!;
    for (const p of onLine(l)) expect(Math.hypot(p.x, p.y) / R).toBeCloseTo((0.6 + 0.95) / 2, 1);
  });

  it('ring text is drawn only near the ring', () => {
    const doc = tokenWith({ shape: 'ring', ...RING_TEXT_STYLE, color: '#00ff00', textOutline: { width: 0, color: '#000000' } });
    doc.frame = { ...doc.frame, style: 'none' };
    const ring = decorationGeometry(doc).ringAt(90) * R;
    const pixels = pixelsOf(draw(doc), 256, GREEN);
    expect(pixels.length).toBeGreaterThan(100);
    for (const p of pixels) {
      const r = Math.hypot(p.x - R, p.y - R);
      expect(Math.abs(r - ring)).toBeLessThan(doc.label!.size * R);
      expect(p.y).toBeGreaterThan(R); // the bottom half
    }
  });

  it('ring text can sit anywhere round the ring, and alignment moves it along', () => {
    const at = (patch: Partial<LabelSettings>) => labelPlacement(tokenWith({ shape: 'ring', place: 'free', ...patch }))!.centre;
    const right = at({ angle: 0 });
    expect(right.x).toBeGreaterThan(0.6);
    expect(Math.abs(right.y)).toBeLessThan(0.05);
    // Left-aligned text starts at the angle, so its middle is further round.
    expect(at({ angle: 270, align: 'left' }).x).toBeGreaterThan(0.1);
    expect(at({ angle: 270, align: 'right' }).x).toBeLessThan(-0.1);
  });

  it('a bent banner’s text follows the bend', () => {
    const smile = layoutLabel(measure, tokenWith({ curve: 60, text: 'Goblin Boss' }), R)!;
    const ys = smile.glyphs!.map((g) => g.y);
    // The ends are higher (smaller y) than the middle.
    expect(ys[0]!).toBeLessThan(ys[5]! - 2);
    expect(ys[ys.length - 1]!).toBeLessThan(ys[5]! - 2);
    // The first letters run downhill towards the middle, the last ones uphill.
    expect(smile.glyphs![0]!.rotation).toBeGreaterThan(0.1);
    expect(smile.glyphs![smile.glyphs!.length - 1]!.rotation).toBeLessThan(-0.1);
    const frown = layoutLabel(measure, tokenWith({ curve: -60, place: 'top', text: 'Goblin Boss' }), R)!;
    expect(frown.glyphs![0]!.y).toBeGreaterThan(frown.glyphs![5]!.y + 2);
    // Straight, with no extra spacing, the words are drawn in one go (keeping the font's joined letters).
    const flat = layoutLabel(measure, tokenWith({ curve: 0, letterSpacing: 0 }), R)!;
    expect(flat.glyphs).toBeNull();
    expect(flat.whole?.text).toBe('Goblin Boss');
  });
});

describe('shrink to fit', () => {
  const R = 128;
  const LONG = 'Grimbold the Unbearably Long-Winded, Lord of Everything';

  it.each(['banner', 'plaque', 'pill', 'box'] as const)('a long name shrinks to stay on the %s', (shape) => {
    const doc = tokenWith({ shape, text: LONG });
    const l = layoutLabel(measure, doc, R)!;
    expect(l.natural).toBeGreaterThan(l.room);
    expect(l.fontPx).toBeLessThan(doc.label!.size * R);
    // After shrinking it fits the room on the shape.
    expect(l.natural * (l.fontPx / (doc.label!.size * R))).toBeLessThanOrEqual(l.room + 0.5);
    const short = layoutLabel(measure, tokenWith({ shape, text: 'Bob' }), R)!;
    expect(short.fontPx).toBeCloseTo(doc.label!.size * R, 6);
  });

  it('no text pixels spill off the shape', () => {
    const doc = tokenWith({ shape: 'box', text: 'Grimbold the Unbearably Long-Winded', color: '#00ff00', size: 0.3, bold: true });
    const box = labelPlacement(doc)!.outline;
    const size = 512;
    const pixels = pixelsOf(draw(doc, size), size, GREEN);
    expect(pixels.length).toBeGreaterThan(50);
    const half = size / 2;
    for (const p of pixels) expect(pointInPolygon({ x: (p.x - half) / half, y: (p.y - half) / half }, box)).toBe(true);
  });

  it('switched off, the shape grows to fit the words instead (never wider than the token)', () => {
    const medium = tokenWith({ shape: 'pill', text: 'Grimbold the', shrinkToFit: false });
    const fixed = labelPlacement({ ...medium, label: { ...medium.label!, shrinkToFit: true } })!.outline;
    const grown = labelPlacement(medium)!.outline;
    const width = (pts: { x: number }[]) => Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    expect(width(grown)).toBeGreaterThan(width(fixed) + 0.1);
    expect(layoutLabel(measure, medium, R)!.fontPx).toBeCloseTo(medium.label!.size * R, 6);
    const huge = labelPlacement({ ...medium, label: { ...medium.label!, text: LONG } })!.outline;
    expect(width(huge)).toBeLessThanOrEqual(1.96 + 1e-6);
  });

  it('ring text shrinks to stay inside its part of the ring', () => {
    const doc = tokenWith({ shape: 'ring', text: LONG, arc: 120 });
    const l = layoutLabel(measure, doc, R)!;
    const pts = l.glyphs!;
    const first = Math.atan2(pts[0]!.y, pts[0]!.x);
    const last = Math.atan2(pts[pts.length - 1]!.y, pts[pts.length - 1]!.x);
    const span = (((first - last) * 180) / Math.PI + 360) % 360;
    expect(span).toBeLessThan(125);
    expect(span).toBeGreaterThan(90);
  });
});

describe('placing the label', () => {
  it('is the same size on the map at every creature size', () => {
    const medium = layoutLabel(measure, tokenWith({}), 128)!;
    // A Large token is 2 squares: at the same pixels per square it is drawn twice as big.
    const large = layoutLabel(measure, tokenWith({}, { size: { preset: 'large', squares: 2 } }), 256)!;
    expect(large.fontPx).toBeCloseTo(medium.fontPx, 6);
  });

  it('snapped to the top or bottom it sits on the frame and stays inside the square', () => {
    for (const shape of ['banner', 'plaque', 'pill', 'box'] as const) {
      for (const place of ['top', 'bottom'] as const) {
        const doc = tokenWith({ shape, place, size: 0.4 });
        const p = labelPlacement(doc)!;
        expect(Math.abs(p.centre.x)).toBeLessThan(1e-9);
        expect(Math.sign(p.centre.y)).toBe(place === 'top' ? -1 : 1);
        for (const q of p.outline) expect(Math.abs(q.y)).toBeLessThanOrEqual(0.99);
      }
    }
  });

  it('dragging snaps to the top or bottom when near, and is free elsewhere', () => {
    const doc = tokenWith({});
    const l = doc.label!;
    const bottom = labelPlacement(doc)!.centre;
    expect(draggedLabel(doc, l, { x: bottom.x + 0.05, y: bottom.y - 0.05 }, false).place).toBe('bottom');
    const top = draggedLabel(doc, l, { x: 0.02, y: -bottom.y }, false);
    expect(top.place).toBe('top');
    expect(top.curve).toBe(-l.curve); // the bend follows the top of the ring
    const free = draggedLabel(doc, l, { x: 0.3, y: 0.1 }, false);
    expect(free).toMatchObject({ place: 'free', x: 0.3, y: 0.1 });
    // Alt (free) never snaps.
    expect(draggedLabel(doc, l, bottom, true).place).toBe('free');
    // A free label is drawn where it was dropped.
    const moved = labelPlacement({ ...doc, label: free })!.centre;
    expect(moved.x).toBeCloseTo(0.3, 6);
    expect(moved.y).toBeCloseTo(0.1, 6);
  });

  it('dragging ring text moves it round the ring, snapping at the top and bottom', () => {
    const doc = tokenWith({ shape: 'ring' });
    const l = doc.label!;
    expect(draggedLabel(doc, l, { x: 0.05, y: 0.8 }, false).place).toBe('bottom');
    expect(draggedLabel(doc, l, { x: -0.05, y: -0.8 }, false).place).toBe('top');
    expect(draggedLabel(doc, l, { x: 0.8, y: 0 }, false)).toMatchObject({ place: 'free', angle: 0 });
  });

  it('the label is drawn on top of everything, inside the square', () => {
    const doc = tokenWith({ shape: 'box', place: 'free', x: 0.95, y: 0, fill: '#ff0000', size: 0.3 });
    const canvas = createCanvas(300, 300);
    const ctx = canvas.getContext('2d');
    ctx.translate(20, 20);
    renderToken(ctx as unknown as Ctx, doc, new Map(), 256);
    // Over the frame at the right-hand edge, and nothing past the square.
    const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    expect(at(20 + 250, 20 + 128)[0]).toBeGreaterThan(150);
    expect(at(20 + 262, 20 + 128)[3]).toBe(0);
  });
});
