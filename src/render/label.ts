// Layer 14 (DESIGN.md §5, §6.10): the label. A banner, plaque, pill or box
// with the token's name on it, snapped to the top or bottom of the frame or
// placed freely, or the name curved round the ring (along the middle of the
// frame band, following the token's shape or a picture frame's hole). Sizes
// are per grid square, so a label is the same size on the map whatever the
// creature's size. Text is laid out letter by letter along a path, so the
// same code draws straight, arched and ring text.

import type { LabelAnchor, LabelSettings, TokenDocument } from '../document/types';
import { cssFont } from '../fonts/catalog';
import { newCanvas } from '../image/processedArt';
import { rgba, shade } from './color';
import { decorationGeometry } from './decorations';
import type { Ctx } from './frameKit';
import type { Point } from './shapes';

type LabelDoc = Pick<TokenDocument, 'label' | 'name' | 'shape' | 'frame' | 'size' | 'shadows' | 'lighting'>;

/** The words on the label: its own text, or the token's name. */
export function labelText(doc: Pick<TokenDocument, 'label' | 'name'>): string {
  const l = doc.label;
  return (l?.text ?? doc.name).replace(/\s+/g, ' ').trim();
}

/** A point on a path, and the way the path runs there (radians). */
interface PathPoint extends Point {
  angle: number;
}

/** A path measured by its length: `at(s)` is the point `s` px along it. */
interface Path {
  length: number;
  at: (s: number) => Point;
}

/** One letter, placed. */
export interface Glyph {
  ch: string;
  x: number;
  y: number;
  /** Radians. */
  rotation: number;
}

/** Where everything goes, in px from the token centre, for a token of half-size R. */
export interface LabelLayout {
  /** The font size actually used (after shrinking to fit). */
  fontPx: number;
  font: string;
  /** The letters, or null when the text is drawn in one go (straight, no extra spacing). */
  glyphs: Glyph[] | null;
  /** Straight text drawn in one go: where its middle is. */
  whole: { text: string; x: number; y: number } | null;
  /** The shape's outline (none for ring text), and its parts for drawing. */
  shape: LabelShapeParts | null;
  /** An outline round the whole label, for picking it on the canvas. */
  hit: Point[];
  /** The text's width before any shrinking, and the room it had (px). */
  natural: number;
  room: number;
  /** Where the label's middle is (px): the shape's centre, or the text's middle on the ring. */
  centre: Point;
  /** Where its anchor point is (px): what a free label's x, y set (v8). The centre for ring text. */
  anchor: Point;
  /**
   * A free label's move and turn round its anchor point (v8): the shape,
   * glyphs and whole text are laid out before it, and drawn with it. The
   * hit outline, centre and anchor already include it.
   */
  transform: { x: number; y: number; angle: number } | null;
}

export interface LabelShapeParts {
  body: Point[] | ((ctx: Ctx) => void);
  /** Banner tails and folds, drawn behind the body in darker tones. */
  tails: Point[][];
  folds: Point[][];
  /** Plaque: an inner border line. */
  inner: ((ctx: Ctx) => void) | null;
  /** Bounding box of the whole shape, for the shading gradient. */
  top: number;
  bottom: number;
  outline: Point[];
}

// ---- Measuring ----

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
/** The letters of `text` (whole emoji and accented letters stay together). */
export function splitLetters(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

const advanceCache = new Map<string, number[]>();
const capCache = new Map<string, number>();

/**
 * Forgets measured letters. Call when a font finishes loading: until then the
 * browser measures with a stand-in font under the same name.
 */
export function clearLabelMeasurements(): void {
  advanceCache.clear();
  capCache.clear();
}

/**
 * Each letter's advance at a 100 px font, measured on prefixes so kerning
 * between letters is kept. Without a canvas (tests of the UI) letters are
 * guessed at 0.6 em.
 */
function advances(measure: Ctx | null, font: (px: number) => string, letters: string[]): number[] {
  if (!measure) return letters.map(() => 60);
  const key = `${font(100)}|${letters.join('')}`;
  let out = advanceCache.get(key);
  if (!out) {
    measure.save();
    measure.font = font(100);
    out = [];
    let prev = 0;
    let prefix = '';
    for (const ch of letters) {
      prefix += ch;
      const w = measure.measureText(prefix).width;
      out.push(w - prev);
      prev = w;
    }
    measure.restore();
    advanceCache.set(key, out);
    while (advanceCache.size > 200) advanceCache.delete(advanceCache.keys().next().value!);
  }
  return out;
}

/** How far above the baseline capital letters reach, as a share of the font size. */
function capHeight(measure: Ctx | null, font: (px: number) => string): number {
  if (!measure) return 0.7;
  const key = font(100);
  let cap = capCache.get(key);
  if (cap === undefined) {
    measure.save();
    measure.font = key;
    const h = measure.measureText('H').actualBoundingBoxAscent;
    measure.restore();
    cap = Number.isFinite(h) && h > 0 ? h / 100 : 0.7;
    capCache.set(key, cap);
  }
  return cap;
}

// ---- Paths ----

/** A path through points, measured by length. */
function polylinePath(points: Point[]): Path & { lengths: number[] } {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  const length = lengths[lengths.length - 1]!;
  const at = (s: number): Point => {
    if (s <= 0) return points[0]!;
    if (s >= length) return points[points.length - 1]!;
    let lo = 0;
    let hi = lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid]! <= s) lo = mid;
      else hi = mid;
    }
    const a = points[lo]!;
    const b = points[hi]!;
    const t = (s - lengths[lo]!) / (lengths[hi]! - lengths[lo]! || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };
  return { length, at, lengths };
}

/**
 * The middle line of a straight or arched shape: `t` runs from -w/2 to w/2
 * along it (px). `radius` null is straight; positive bends the ends up.
 */
function centreLine(cx: number, cy: number, radius: number | null): (t: number) => PathPoint & { nx: number; ny: number } {
  if (!radius) return (t) => ({ x: cx + t, y: cy, angle: 0, nx: 0, ny: -1 });
  return (t) => {
    const a = t / radius;
    return { x: cx + radius * Math.sin(a), y: cy - radius * (1 - Math.cos(a)), angle: a, nx: -Math.sin(a), ny: -Math.cos(a) };
  };
}

/** Places letters along a path from `start` px, each turned to follow it. */
function placeGlyphs(letters: string[], widths: number[], spacing: number, path: Path, start: number, rise: number): Glyph[] {
  const out: Glyph[] = [];
  let s = start;
  letters.forEach((ch, i) => {
    const w = widths[i]!;
    const a = path.at(s);
    const b = path.at(s + Math.max(w, 0.5));
    const rotation = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = path.at(s + w / 2);
    // Letters sit with their capitals centred on the line.
    out.push({ ch, x: mid.x - Math.sin(rotation) * rise, y: mid.y + Math.cos(rotation) * rise, rotation });
    s += w + spacing;
  });
  return out;
}

// ---- Layout ----

/** Room either side of the text, as a share of the shape's height. */
const PAD: Record<string, number> = { banner: 0.3, plaque: 0.42, pill: 0.5, box: 0.3, plain: 0.05 };
/** The shape's height, as a multiple of the text size. */
const HEIGHT: Record<string, number> = { banner: 1.75, plaque: 2, pill: 1.7, box: 1.7, plain: 1.2 };

/** Where each anchor point is on a w × h label, as shares of its width and height from its middle (v8). */
const ANCHOR_AT: Record<LabelAnchor, [number, number]> = {
  topLeft: [-0.5, -0.5],
  top: [0, -0.5],
  topRight: [0.5, -0.5],
  left: [-0.5, 0],
  center: [0, 0],
  right: [0.5, 0],
  bottomLeft: [-0.5, 0.5],
  bottom: [0, 0.5],
  bottomRight: [0.5, 0.5],
};

/**
 * Lays the label out for a token of half-size `R` px. `measure` is any 2D
 * context, used only to measure text (null guesses, for tests without a canvas).
 */
export function layoutLabel(measure: Ctx | null, doc: LabelDoc, R: number): LabelLayout | null {
  const l = doc.label;
  if (!l) return null;
  const text = labelText(doc);
  if (!text) return null;
  const sq = doc.size.squares;
  const unit = R / sq; // px per "per square" unit
  const font = (px: number) => cssFont(l.font, px, l.bold, l.italic);
  const letters = splitLetters(text);
  const adv = advances(measure, font, letters);
  const cap = capHeight(measure, font);
  let fontPx = l.size * unit;
  const widthAt = (px: number) => (adv.reduce((s, w) => s + w, 0) * px) / 100 + l.letterSpacing * px * Math.max(0, letters.length - 1);
  const natural = widthAt(fontPx);
  const geo = decorationGeometry(doc);

  if (l.shape === 'ring') {
    const deg = l.place === 'top' ? 270 : l.place === 'bottom' ? 90 : l.angle;
    const a = ((deg % 360) + 360) % 360;
    // Along the bottom the text runs the other way round, so it reads upright.
    const dir = a > 0.5 && a < 179.5 ? -1 : 1;
    const points: Point[] = [];
    for (let i = 0; i <= 720; i++) {
      const d = a + dir * (i / 2 - 180);
      const r = geo.ringAt(d) * R;
      points.push({ x: r * Math.cos((d * Math.PI) / 180), y: r * Math.sin((d * Math.PI) / 180) });
    }
    const path = polylinePath(points);
    const middle = path.lengths[360]!;
    const room = (path.length * Math.min(360, l.arc)) / 360;
    if (l.shrinkToFit && natural > room) fontPx *= room / natural;
    const used = Math.min(path.length * 0.98, widthAt(fontPx));
    const start = l.align === 'left' ? middle : l.align === 'right' ? middle - used : middle - used / 2;
    const widths = adv.map((w) => (w * fontPx) / 100);
    const glyphs = placeGlyphs(letters, widths, l.letterSpacing * fontPx, path, start, (cap * fontPx) / 2);
    // Picking: a band round the text's path.
    const band = fontPx * 0.75;
    const side = (k: number) => {
      const pts: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const s = start + (used * i) / 24;
        const p = path.at(s);
        const q = path.at(s + 1);
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        pts.push({ x: p.x + Math.sin(ang) * band * k, y: p.y - Math.cos(ang) * band * k });
      }
      return pts;
    };
    const centre = path.at(start + used / 2);
    return { fontPx, font: font(fontPx), glyphs, whole: null, shape: null, hit: [...side(1), ...side(-1).reverse()], natural, room, centre, anchor: centre, transform: null };
  }

  // A shape: banner, plaque, pill or box, or plain text with no shape (v8).
  const h = fontPx * HEIGHT[l.shape]!;
  const pad = h * PAD[l.shape]!;
  let w = l.width * unit;
  const room0 = Math.max(1, w - pad * 2);
  if (l.shrinkToFit) {
    if (natural > room0) fontPx *= room0 / natural;
  } else {
    // The shape grows to fit the text instead (never wider than the token).
    w = Math.min(R * 1.96, Math.max(w, natural + pad * 2));
    const room1 = w - pad * 2;
    if (natural > room1) fontPx *= room1 / natural;
  }
  const textW = widthAt(fontPx);
  const room = w - pad * 2;
  const bend = l.shape === 'banner' ? (l.curve / 100) * (Math.PI / 2) : 0;
  const radius = Math.abs(bend) > 1e-3 ? w / bend : null;

  const free = l.place === 'free';
  const [ax, ay] = ANCHOR_AT[l.anchor] ?? ANCHOR_AT.center;
  // A free label is laid out round its anchor point, then moved and turned there.
  let cx = free ? -ax * w : 0;
  let cy = free ? -ay * h : l.place === 'top' ? -geo.ringAt(270) * R : geo.ringAt(90) * R;
  let parts = shapeParts(l, cx, cy, w, h, radius);
  if (l.place !== 'free') {
    // Snapped labels stay inside the square.
    const ys = parts.outline.map((p) => p.y);
    const over = Math.max(...ys) - R * 0.985;
    const under = -R * 0.985 - Math.min(...ys);
    const dy = over > 0 ? -over : under > 0 ? under : 0;
    if (dy) {
      cy += dy;
      parts = shapeParts(l, cx, cy, w, h, radius);
    }
    cx = 0;
  }

  const line = centreLine(cx, cy, radius);
  const start = -w / 2 + pad + (l.align === 'left' ? 0 : l.align === 'right' ? room - textW : (room - textW) / 2);
  const rise = (cap * fontPx) / 2;
  let glyphs: Glyph[] | null = null;
  let whole: LabelLayout['whole'] = null;
  if (!radius && Math.abs(l.letterSpacing) < 1e-4) {
    whole = { text, x: cx + start + textW / 2, y: cy + rise };
  } else {
    const pts: Point[] = [];
    for (let i = 0; i <= 64; i++) pts.push(line(-w / 2 - h + ((w + h * 2) * i) / 64));
    const path = polylinePath(pts);
    const widths = adv.map((x) => (x * fontPx) / 100);
    glyphs = placeGlyphs(letters, widths, l.letterSpacing * fontPx, path, start + w / 2 + h, rise);
  }
  if (!free) {
    const centre = { x: cx, y: cy };
    return { fontPx, font: font(fontPx), glyphs, whole, shape: parts, hit: parts.outline, natural, room, centre, anchor: { x: cx + ax * w, y: cy + ay * h }, transform: null };
  }
  const transform = { x: l.x * R, y: l.y * R, angle: (l.rotation * Math.PI) / 180 };
  const place = (p: Point): Point => {
    const c = Math.cos(transform.angle);
    const sn = Math.sin(transform.angle);
    return { x: transform.x + p.x * c - p.y * sn, y: transform.y + p.x * sn + p.y * c };
  };
  return {
    fontPx,
    font: font(fontPx),
    glyphs,
    whole,
    shape: parts,
    hit: parts.outline.map(place),
    natural,
    room,
    centre: place({ x: cx, y: cy }),
    anchor: { x: transform.x, y: transform.y },
    transform,
  };
}

/** The shape's outline and pieces, centred at (cx, cy), `w` × `h` px. */
function shapeParts(l: LabelSettings, cx: number, cy: number, w: number, h: number, radius: number | null): LabelShapeParts {
  const box = (x0: number, y0: number, x1: number, y1: number): Point[] => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const outlineBox = box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  if (l.shape === 'pill' || l.shape === 'box' || l.shape === 'plain') {
    // Plain text has no shape drawn; its box is only for picking it on the canvas.
    const r = l.shape === 'pill' ? h / 2 : l.corners === 'rounded' && l.shape === 'box' ? h * 0.24 : 0;
    return {
      body: (ctx) => roundRect(ctx, cx - w / 2, cy - h / 2, w, h, r),
      tails: [],
      folds: [],
      inner: null,
      top: cy - h / 2,
      bottom: cy + h / 2,
      outline: outlineBox,
    };
  }
  if (l.shape === 'plaque') {
    const r = h * 0.26;
    const inset = h * 0.12;
    return {
      body: (ctx) => plaquePath(ctx, cx, cy, w, h, r),
      tails: [],
      folds: [],
      inner: (ctx) => plaquePath(ctx, cx, cy, w - inset * 2, h - inset * 2, Math.max(1, r - inset * 0.6)),
      top: cy - h / 2,
      bottom: cy + h / 2,
      outline: outlineBox,
    };
  }
  // Banner: a band along the middle line, with notched tails folded behind each end.
  const line = centreLine(cx, cy, radius);
  const along = (t0: number, t1: number, off: number, half: number, notch = 0, end: 1 | -1 = 1): Point[] => {
    const top: Point[] = [];
    const bottom: Point[] = [];
    for (let i = 0; i <= 24; i++) {
      const p = line(t0 + ((t1 - t0) * i) / 24);
      const o = { x: p.x - p.nx * off, y: p.y - p.ny * off };
      top.push({ x: o.x + p.nx * half, y: o.y + p.ny * half });
      bottom.push({ x: o.x - p.nx * half, y: o.y - p.ny * half });
    }
    const pts = [...top, ...bottom.reverse()];
    if (notch) {
      // A swallowtail notch at the t1 end.
      const p = line(t1 - end * notch);
      pts.splice(top.length, 0, { x: p.x - p.nx * off, y: p.y - p.ny * off });
    }
    return pts;
  };
  const body = along(-w / 2, w / 2, 0, h / 2);
  const tailOff = h * 0.32;
  const tailHalf = h * 0.42;
  const tails: Point[][] = [];
  const folds: Point[][] = [];
  for (const e of [-1, 1] as const) {
    const t0 = e * (w / 2 - h * 0.35);
    const t1 = e * (w / 2 + h * 0.7);
    const tail = along(t0, t1, tailOff, tailHalf, h * 0.32, e);
    tails.push(tail);
    const end = line((e * w) / 2);
    const inner = line(t0);
    folds.push([
      { x: end.x - end.nx * (h / 2), y: end.y - end.ny * (h / 2) },
      { x: end.x - end.nx * (tailOff + tailHalf), y: end.y - end.ny * (tailOff + tailHalf) },
      { x: inner.x - inner.nx * (tailOff + tailHalf), y: inner.y - inner.ny * (tailOff + tailHalf) },
    ]);
  }
  const all = [...body, ...tails.flat()];
  const ys = all.map((p) => p.y);
  // The outline used for picking: the band plus its tails' extent.
  const outline = [...along(-w / 2 - h * 0.7, w / 2 + h * 0.7, tailOff / 2, h / 2 + tailOff / 2)];
  return { body, tails, folds, inner: null, top: Math.min(...ys), bottom: Math.max(...ys), outline };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.arcTo(x + w, y, x + w, y + k, k);
  ctx.lineTo(x + w, y + h - k);
  ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
  ctx.lineTo(x + k, y + h);
  ctx.arcTo(x, y + h, x, y + h - k, k);
  ctx.lineTo(x, y + k);
  ctx.arcTo(x, y, x + k, y, k);
  ctx.closePath();
}

/** A rectangle with scooped-in corners. */
function plaquePath(ctx: Ctx, cx: number, cy: number, w: number, h: number, r: number): void {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x0 + k, y0);
  ctx.lineTo(x1 - k, y0);
  ctx.arc(x1, y0, k, Math.PI, Math.PI / 2, true);
  ctx.lineTo(x1, y1 - k);
  ctx.arc(x1, y1, k, -Math.PI / 2, -Math.PI, true);
  ctx.lineTo(x0 + k, y1);
  ctx.arc(x0, y1, k, 0, -Math.PI / 2, true);
  ctx.lineTo(x0, y0 + k);
  ctx.arc(x0, y0, k, Math.PI / 2, 0, true);
  ctx.closePath();
}

function trace(ctx: Ctx, body: LabelShapeParts['body'] | Point[]): void {
  ctx.beginPath();
  if (typeof body === 'function') body(ctx);
  else {
    body.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
}

// ---- Drawing ----

/** Unit vector of the way a shadow falls, away from the light. */
function fallVector(doc: LabelDoc): Point {
  const s = doc.shadows.outer;
  const deg = s.followLight ? doc.lighting.direction - 180 : s.angle;
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/**
 * Draws the label. The context's origin is the token centre, `R` its
 * half-size and `size` the whole square in pixels.
 */
export function drawLabel(ctx: Ctx, doc: LabelDoc, R: number, size: number): void {
  const l = doc.label;
  if (!l) return;
  const layout = layoutLabel(ctx, doc, R);
  if (!layout) return;
  const unit = R / doc.size.squares;
  const fall = fallVector(doc);

  // A free label's move and turn round its anchor (v8), applied inside each layer so shadows still fall away from the light.
  const place = (c: Ctx) => {
    c.translate(R, R);
    if (layout.transform) {
      c.translate(layout.transform.x, layout.transform.y);
      c.rotate(layout.transform.angle);
    }
  };

  // The shape, on a layer of its own so its opacity is even where the pieces overlap.
  const parts = layout.shape;
  if (parts && l.opacity > 0 && l.shape !== 'plain') {
    const layer = newCanvas(size, size);
    const s = layer.getContext('2d') as Ctx;
    place(s);
    s.lineJoin = 'round';
    const outlinePx = l.outline.width * unit;
    for (const tail of parts.tails) {
      trace(s, tail);
      s.fillStyle = shade(l.fill, -0.28);
      s.fill();
      if (outlinePx > 0) stroke(s, l.outline.color, outlinePx);
    }
    for (const fold of parts.folds) {
      trace(s, fold);
      s.fillStyle = shade(l.fill, -0.55);
      s.fill();
      if (outlinePx > 0) stroke(s, l.outline.color, outlinePx);
    }
    trace(s, parts.body);
    s.fillStyle = l.fill;
    s.fill();
    // Lit from above, like the frames.
    s.save();
    s.clip();
    const g = s.createLinearGradient(0, parts.top, 0, parts.bottom);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    s.fillStyle = g;
    s.fillRect(-size * 2, -size * 2, size * 4, size * 4);
    s.restore();
    if (outlinePx > 0) {
      trace(s, parts.body);
      stroke(s, l.outline.color, outlinePx);
    }
    if (parts.inner) {
      trace(s, parts.inner);
      stroke(s, rgba(l.outline.color, 0.55), Math.max(0.75, outlinePx * 0.6));
    }
    ctx.save();
    ctx.globalAlpha *= Math.min(1, l.opacity);
    const shadow = doc.shadows.outer;
    if (shadow.enabled) {
      // The shape casts a small version of the token's drop shadow.
      ctx.shadowColor = rgba(shadow.color, shadow.opacity * 0.8);
      ctx.shadowBlur = shadow.blur * unit * 0.6;
      ctx.shadowOffsetX = fall.x * shadow.distance * unit * 0.6;
      ctx.shadowOffsetY = fall.y * shadow.distance * unit * 0.6;
    }
    ctx.drawImage(layer as CanvasImageSource, -R, -R);
    ctx.restore();
  }

  // The text: outline under the letters, then the letters; its shadow falls away from the light.
  const layer = newCanvas(size, size);
  const t = layer.getContext('2d') as Ctx;
  place(t);
  t.font = layout.font;
  t.textAlign = 'center';
  t.textBaseline = 'alphabetic';
  t.lineJoin = 'round';
  t.miterLimit = 2;
  const outlinePx = l.textOutline.width * unit;
  const paint = (draw: (text: string, x: number, y: number) => void) => {
    if (layout.whole) draw(layout.whole.text, layout.whole.x, layout.whole.y);
    else
      for (const g of layout.glyphs!) {
        t.save();
        t.translate(g.x, g.y);
        t.rotate(g.rotation);
        draw(g.ch, 0, 0);
        t.restore();
      }
  };
  if (outlinePx > 0) {
    t.strokeStyle = l.textOutline.color;
    t.lineWidth = outlinePx * 2;
    paint((s, x, y) => t.strokeText(s, x, y));
  }
  t.fillStyle = l.color;
  paint((s, x, y) => t.fillText(s, x, y));
  ctx.save();
  if (l.shadow.enabled && l.shadow.opacity > 0) {
    const blur = l.shadow.blur * unit;
    ctx.shadowColor = rgba(l.shadow.color, l.shadow.opacity);
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = fall.x * (blur * 0.4 + unit * 0.012);
    ctx.shadowOffsetY = fall.y * (blur * 0.4 + unit * 0.012);
  }
  ctx.drawImage(layer as CanvasImageSource, -R, -R);
  ctx.restore();
}

function stroke(ctx: Ctx, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

let scratch: Ctx | null | undefined;
/**
 * The label laid out in token units (R = 1), for the editor: its outline
 * (for picking it on the canvas) and its middle. Null without a label.
 */
export function labelPlacement(doc: LabelDoc): { outline: Point[]; centre: Point; anchor: Point } | null {
  if (scratch === undefined) {
    try {
      scratch = (newCanvas(1, 1).getContext('2d') as Ctx | null) ?? null;
    } catch {
      scratch = null;
    }
  }
  const R = 200;
  const layout = layoutLabel(scratch, doc, R);
  if (!layout) return null;
  return {
    outline: layout.hit.map((p) => ({ x: p.x / R, y: p.y / R })),
    centre: { x: layout.centre.x / R, y: layout.centre.y / R },
    anchor: { x: layout.anchor.x / R, y: layout.anchor.y / R },
  };
}

/** Within this far (token units) of the top or bottom snap point, a dragged label snaps there. */
export const LABEL_SNAP = 0.15;
/** Ring text snaps to the top or bottom within this many degrees. */
export const RING_SNAP = 12;

/** Where a label's anchor point is when snapped to the top or bottom (token units). */
export function labelSnapPoint(doc: LabelDoc, place: 'top' | 'bottom'): Point {
  const l = doc.label;
  if (!l) return { x: 0, y: 0 };
  const p = labelPlacement({ ...doc, label: { ...l, place } });
  return p ? p.anchor : { x: 0, y: 0 };
}
