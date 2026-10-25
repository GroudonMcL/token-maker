// The shapes a Repeated shapes layer can use. Each is drawn centred on the
// origin in a point's local frame (+x along the band, +y in towards the
// token's centre), `h` pixels tall and `h * stretch` wide.

import { shade } from '../../render/color';
import { noShadow, seededRandom, sphere } from '../../render/frameKit';
import { ICON_GLYPHS, type IconGlyph } from '../project/iconGlyphs';
import type { ElementKind, GemCut, GemSetting } from '../project/types';
import type { CanvasLike, Ctx } from './canvas';
import { drawFacets } from './facets';
import { GLYPHS, STROKED, traceGlyph, type Glyph } from './glyphs';
import { turn } from './light';

export const ELEMENT_NAMES: Record<ElementKind, string> = {
  bead: 'Bead (shaded)',
  circle: 'Circle',
  diamond: 'Diamond',
  square: 'Square',
  triangle: 'Triangle',
  star: 'Star',
  cross: 'Cross',
  rune: 'Rune',
  leaf: 'Leaf',
  spike: 'Spike',
  chevron: 'Chevron',
  tick: 'Tick mark',
  gear: 'Gear',
  eye: 'Eye',
  note: 'Music note',
  claw: 'Claw marks',
  gem: 'Cut gem (faceted)',
  plate: 'Hexagonal plate (faceted)',
  shard: 'Crystal shard (faceted)',
  tooth: 'Gear tooth',
  gash: 'Claw gashes (cut in)',
  fletching: 'Fletching (open chevron)',
  bardNote: 'Music note (Bard’s)',
  watchEye: 'Eye (detailed, Warlock’s)',
  cog: 'Cog with a hub',
  sprig: 'Leaf on a stem (Druid’s)',
  heart: 'Heart',
  crescent: 'Crescent moon',
  flame: 'Flame',
  fleur: 'Fleur-de-lis',
  shield: 'Shield',
  sun: 'Sun',
  snowflake: 'Snowflake',
  crown: 'Crown',
  jewel: 'Gem (drawn, two-tone)',
  drop: 'Drop',
  shell: 'Scallop shell',
  spiral: 'Spiral',
  paw: 'Paw print',
  feather: 'Feather',
  knot: 'Celtic knot',
  skull: 'Skull',
  arrow: 'Arrow',
  ...(Object.fromEntries(ICON_GLYPHS.map((g) => [g.id, `${g.name} (icon)`])) as Record<(typeof ICON_GLYPHS)[number]['id'], string>),
};

/** Elements with a second colour (`detail`), and what it is called in the editor. */
export const DETAIL_NAMES: Partial<Record<ElementKind, string>> = {
  watchEye: 'White of the eye',
  gash: 'Lit edge',
  cog: 'Hub',
  flame: 'Inner flame',
  shield: 'Inner field',
  crown: 'Band',
  jewel: 'Top facet',
  shell: 'Ribs',
  feather: 'Shaft',
  knot: 'Cord edge',
  skull: 'Eyes and teeth',
};

/** Elements drawn as lines, whose "outline width" is the thickness of their lines. */
export const LINE_ELEMENTS = new Set<ElementKind>(['rune', 'fletching', ...STROKED]);

/** The outline of a faceted element, pointing outwards, and how it is cut. */
function facetedOutline(kind: ElementKind, w: number, h: number): { pts: { x: number; y: number }[]; table: number; depth: number } | null {
  const x = w / 2;
  const y = h / 2;
  const ring = (n: number, turn: number) => Array.from({ length: n }, (_v, i) => ({ x: Math.cos(turn + (i * Math.PI * 2) / n) * x, y: Math.sin(turn + (i * Math.PI * 2) / n) * y }));
  switch (kind) {
    case 'gem':
      return { pts: ring(8, Math.PI / 8), table: 0.52, depth: 0.9 };
    case 'plate':
      return { pts: ring(6, 0), table: 0.68, depth: 0.55 };
    case 'shard':
      return {
        pts: [
          { x: 0, y: -y },
          { x: x * 0.62, y: -y * 0.45 },
          { x: x * 0.5, y: y },
          { x: -x * 0.5, y: y },
          { x: -x * 0.62, y: -y * 0.45 },
        ],
        table: 0,
        depth: 1.1,
      };
    default:
      return null;
  }
}

/** Little glyphs drawn as strokes (x and y from -1 to 1), in the style of token-maker's Arcane runes. */
const RUNES: number[][][] = [
  [[0, -1, 0, 1], [0, -1, 0.7, -0.4]],
  [[0, -1, 0, 1], [-0.6, -0.3, 0.6, 0.3]],
  [[-0.6, 1, 0, -1], [0, -1, 0.6, 1], [-0.3, 0.2, 0.3, 0.2]],
  [[0, -1, 0, 1], [0, 0, 0.6, -0.6], [0, 0, 0.6, 0.6]],
  [[-0.6, -1, 0.6, 1], [0.6, -1, -0.6, 1]],
  [[0, -1, 0, 1], [-0.6, -0.5, 0, 0], [0.6, -0.5, 0, 0]],
  [[-0.5, -1, 0.5, -1], [0, -1, 0, 1], [-0.5, 1, 0.5, 1]],
];

/** Which rune (or note: single or paired) the i-th element of a layer gets. */
export function runeFor(seed: number, count: number): number[] {
  const random = seededRandom(seed * 7919 + 0x7a1);
  return Array.from({ length: count }, () => Math.floor(random() * RUNES.length));
}

/** Traces the outline of a filled element (everything except bead and rune). */
function trace(ctx: Ctx, kind: ElementKind, w: number, h: number): void {
  const x = w / 2;
  const y = h / 2;
  ctx.beginPath();
  switch (kind) {
    case 'circle':
    case 'bead':
      ctx.ellipse(0, 0, x, y, 0, 0, Math.PI * 2);
      break;
    case 'diamond':
      ctx.moveTo(0, -y);
      ctx.lineTo(x, 0);
      ctx.lineTo(0, y);
      ctx.lineTo(-x, 0);
      break;
    case 'square':
      ctx.rect(-x, -y, w, h);
      break;
    case 'triangle':
      // Points outwards, away from the token's centre.
      ctx.moveTo(0, -y);
      ctx.lineTo(x, y);
      ctx.lineTo(-x, y);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 0.45 : 1;
        ctx.lineTo(Math.cos(a) * x * r, Math.sin(a) * y * r);
      }
      break;
    case 'cross': {
      const t = 0.22;
      ctx.rect(-x * t, -y, w * t, h);
      ctx.rect(-x, -y * t, w, h * t);
      break;
    }
    case 'leaf':
      ctx.moveTo(0, -y);
      ctx.quadraticCurveTo(x * 1.4, 0, 0, y);
      ctx.quadraticCurveTo(-x * 1.4, 0, 0, -y);
      break;
    case 'spike':
      ctx.moveTo(0, -y);
      ctx.quadraticCurveTo(x * 0.25, 0, x, y);
      ctx.lineTo(-x, y);
      ctx.quadraticCurveTo(-x * 0.25, 0, 0, -y);
      break;
    case 'chevron':
      // An arrowhead pointing along the band, like Ranger's fletching.
      ctx.moveTo(-x, -y);
      ctx.lineTo(0, -y);
      ctx.lineTo(x, 0);
      ctx.lineTo(0, y);
      ctx.lineTo(-x, y);
      ctx.lineTo(0, 0);
      break;
    case 'tick':
      ctx.rect(-x * 0.18, -y, w * 0.18, h);
      break;
    case 'gear': {
      const teeth = 8;
      for (let i = 0; i < teeth * 4; i++) {
        const a = -Math.PI / 2 + ((i - 0.5) * Math.PI * 2) / (teeth * 4);
        const r = i % 4 < 2 ? 1 : 0.76;
        ctx.lineTo(Math.cos(a) * x * r, Math.sin(a) * y * r);
      }
      ctx.closePath();
      // The hole, drawn the other way round so it stays empty.
      ctx.moveTo(x * 0.3, 0);
      ctx.ellipse(0, 0, x * 0.3, y * 0.3, 0, 0, -Math.PI * 2, true);
      break;
    }
    case 'eye':
      ctx.moveTo(-x, 0);
      ctx.quadraticCurveTo(0, -y * 1.6, x, 0);
      ctx.quadraticCurveTo(0, y * 1.6, -x, 0);
      break;
    case 'claw':
      // Three tapering gashes.
      for (const k of [-1, 0, 1]) {
        const cx = k * x * 0.62;
        ctx.moveTo(cx - x * 0.26, -y);
        ctx.quadraticCurveTo(cx + x * 0.3, 0, cx + x * 0.14, y);
        ctx.quadraticCurveTo(cx - x * 0.06, 0, cx - x * 0.26, -y);
        ctx.closePath();
      }
      break;
    case 'gem':
    case 'plate':
    case 'shard':
      facetedOutline(kind, w, h)!.pts.forEach((p) => ctx.lineTo(p.x, p.y));
      break;
    case 'tooth': {
      // A ring gear's tooth hanging inwards from its point (as Token Maker's Artificer): wide at its root, narrower at its tip.
      const top = -h * 0.143;
      ctx.moveTo(-x, top);
      ctx.lineTo(x, top);
      ctx.lineTo(x * 0.59, top + h);
      ctx.lineTo(-x * 0.59, top + h);
      break;
    }
    case 'note':
    case 'rune':
    case 'gash':
      break;
  }
  ctx.closePath();
}

/** Music notes: one, or two joined by a beam. */
function traceNote(ctx: Ctx, w: number, h: number, paired: boolean): void {
  const x = w / 2;
  const y = h / 2;
  const heads = paired ? [-x * 0.55, x * 0.45] : [-x * 0.15];
  const stem = Math.max(0.6, w * 0.08);
  ctx.beginPath();
  for (const hx of heads) {
    ctx.ellipse(hx, y * 0.62, x * (paired ? 0.32 : 0.48), y * 0.3, -0.35, 0, Math.PI * 2);
    ctx.closePath();
    const sx = hx + x * (paired ? 0.28 : 0.42);
    ctx.rect(sx - stem, -y, stem, y * 1.55);
  }
  if (paired) ctx.rect(heads[0] + x * 0.28 - stem, -y, heads[1] - heads[0] + stem, y * 0.26);
  else {
    const sx = heads[0] + x * 0.42;
    ctx.moveTo(sx, -y);
    ctx.quadraticCurveTo(sx + x * 0.7, -y * 0.5, sx + x * 0.35, y * 0.1);
    ctx.quadraticCurveTo(sx + x * 0.45, -y * 0.45, sx, -y * 0.55);
    ctx.closePath();
  }
}

/**
 * Fills the current path (or `path`) with `color`, brighter towards the
 * light and darker away from it (or flat, if not `shaded`). A paint's
 * pattern is laid down as it is, with the same light and shade over it.
 * The shading is centred on (`cx`, `cy`).
 */
export function shadedFill(
  ctx: Ctx,
  color: string | CanvasPattern,
  w: number,
  h: number,
  light: { x: number; y: number },
  rule: CanvasFillRule = 'nonzero',
  shaded = true,
  path?: Path2D,
  cx = 0,
  cy = 0,
): void {
  const fill = () => (path ? ctx.fill(path, rule) : ctx.fill(rule));
  const { x, y } = light;
  const across = () => ctx.createLinearGradient(cx + (x * w) / 2, cy + (y * h) / 2, cx - (x * w) / 2, cy - (y * h) / 2);
  if (typeof color !== 'string') {
    ctx.fillStyle = color;
    fill();
    if (!shaded) return;
    const gradient = across();
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    // The paint has cast the shadow; the light and shade over it shouldn't again.
    ctx.save();
    noShadow(ctx);
    ctx.fillStyle = gradient;
    fill();
    ctx.restore();
    return;
  }
  if (!shaded) {
    ctx.fillStyle = color;
    fill();
    return;
  }
  const gradient = across();
  gradient.addColorStop(0, shade(color, 0.25));
  gradient.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = gradient;
  fill();
}

/** A paint for filling elements with: the whole picture's paint (paint.ts paintCanvas), across the token or shrunk into each element. */
export interface PaintSource {
  canvas: CanvasLike;
  /** Each element gets the whole paint, shrunk into its box; otherwise the paint runs across the token. */
  each: boolean;
}

type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };

const times = (m: Affine, n: Affine): Affine => ({
  a: m.a * n.a + m.c * n.b,
  b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d,
  d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e,
  f: m.b * n.e + m.d * n.f + m.f,
});

function inverse(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c || 1e-12;
  return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det, e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det };
}

/**
 * The paint as a pattern for filling now: `frame` is the element's own
 * transform (its centre, turned with it), `w` × `h` its box. Across the
 * token, the paint's pixels land where they are on the picture; each on its
 * own, the whole paint is shrunk into the box.
 */
export function paintPattern(ctx: Ctx, paint: PaintSource, frame: Affine, w: number, h: number): CanvasPattern {
  const pattern = ctx.createPattern(paint.canvas as CanvasImageSource, 'no-repeat')!;
  const size = (paint.canvas as { width: number }).width;
  const toDevice: Affine = paint.each ? times(frame, { a: w / size, b: 0, c: 0, d: h / size, e: -w / 2, f: -h / 2 }) : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  pattern.setTransform(times(inverse(ctx.getTransform()), toDevice));
  return pattern;
}

/** How a cut gem is cut (DESIGN.md §5.6). Phase 6's gem is the brilliant at its defaults. */
export interface GemStyle {
  cut: GemCut;
  table: number;
  crown: number;
  facets: number;
  sparkle: number;
  /** Picks a rough crystal's shape. */
  seed: number;
}

export const DEFAULT_GEM: GemStyle = { cut: 'brilliant', table: 0.52, crown: 0.9, facets: 8, sparkle: 0, seed: 1 };

const ellipsePts = (x: number, y: number, n: number, turn = 0) => Array.from({ length: n }, (_v, i) => ({ x: Math.cos(turn + (i * Math.PI * 2) / n) * x, y: Math.sin(turn + (i * Math.PI * 2) / n) * y }));

/** The gem's outline (its girdle), which a setting also follows. */
export function gemOutline(gem: GemStyle, w: number, h: number): { x: number; y: number }[] {
  const x = w / 2;
  const y = h / 2;
  switch (gem.cut) {
    case 'brilliant':
    case 'rose':
      return ellipsePts(x, y, gem.facets, Math.PI / gem.facets);
    case 'cabochon':
      return ellipsePts(x, y, 32);
    case 'emerald': {
      // A rectangle with its corners cut off.
      const c = Math.min(x, y) * 0.42;
      return [
        { x: -x + c, y: -y },
        { x: x - c, y: -y },
        { x, y: -y + c },
        { x, y: y - c },
        { x: x - c, y },
        { x: -x + c, y },
        { x: -x, y: y - c },
        { x: -x, y: -y + c },
      ];
    }
    case 'rough': {
      const random = seededRandom(gem.seed * 977 + 0x60b);
      return Array.from({ length: gem.facets }, (_v, i) => {
        const a = (i + (random() - 0.5) * 0.6) * ((Math.PI * 2) / gem.facets) - Math.PI / 2;
        const r = 0.72 + random() * 0.28;
        return { x: Math.cos(a) * x * r, y: Math.sin(a) * y * r };
      });
    }
  }
}

const scalePts = (pts: { x: number; y: number }[], k: number, turnBy = 0) =>
  pts.map((p) => ({ x: (p.x * Math.cos(turnBy) - p.y * Math.sin(turnBy)) * k, y: (p.x * Math.sin(turnBy) + p.y * Math.cos(turnBy)) * k }));

/** Draws a cut gem centred on the origin, `w`×`h`, lit from `light` (a unit vector in this frame). */
export function drawGem(ctx: Ctx, gem: GemStyle, w: number, h: number, color: string, light: { x: number; y: number }, shaded = true): void {
  const pts = gemOutline(gem, w, h);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = color;
  // The outline first (it casts any shadow), then the faces over it.
  ctx.fill();
  if (!shaded) return;
  ctx.save();
  ctx.shadowColor = 'transparent';
  switch (gem.cut) {
    case 'brilliant':
    case 'rough':
      drawFacets(ctx, pts, color, light, gem.cut === 'rough' ? 0 : gem.table, gem.crown);
      break;
    case 'rose': {
      // A ring of facets, then a pyramid of triangles to a point.
      drawFacets(ctx, pts, color, light, 0.58, gem.crown * 0.7);
      drawFacets(ctx, scalePts(pts, 0.58, Math.PI / gem.facets), color, light, 0, gem.crown);
      break;
    }
    case 'emerald': {
      // Steps cut down from a flat table.
      let tier = pts;
      for (const k of [0.84, 0.84, 0.86]) {
        drawFacets(ctx, tier, color, light, k, gem.crown * 0.45);
        tier = scalePts(tier, k);
      }
      // The table, as big as asked.
      ctx.beginPath();
      scalePts(pts, Math.max(0.05, gem.table)).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = shade(color, 0.08);
      ctx.fill();
      break;
    }
    case 'cabochon': {
      // A smooth dome: brighter towards the light, with a soft highlight.
      const r = Math.max(w, h) / 2;
      const g = ctx.createRadialGradient((light.x * w) / 4, (light.y * h) / 4, 0, 0, 0, r);
      g.addColorStop(0, shade(color, 0.45));
      g.addColorStop(0.55, color);
      g.addColorStop(1, shade(color, -0.5));
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse((light.x * w) / 4.5, (light.y * h) / 4.5, w * 0.12, h * 0.08, Math.atan2(light.y, light.x) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
      break;
    }
  }
  if (gem.sparkle > 0) {
    // A four-pointed glint on the side facing the light.
    const s = Math.min(w, h) * 0.32 * gem.sparkle;
    const cx = (light.x * w) / 5;
    const cy = (light.y * h) / 5;
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * gem.sparkle})`;
    for (const [dx, dy] of [
      [1, 0.14],
      [0.14, 1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(cx - s * dx, cy);
      ctx.lineTo(cx, cy - s * dy);
      ctx.lineTo(cx + s * dx, cy);
      ctx.lineTo(cx, cy + s * dy);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * A metal setting round an element (`w`×`h`, following a gem's girdle or an
 * oval): the part behind it (a bezel cup, or the claws' prongs) or the part
 * in front (the bezel's lip, or the claws' tips gripping the stone).
 */
export function drawSetting(ctx: Ctx, setting: GemSetting, part: 'back' | 'front', outline: { x: number; y: number }[], w: number, h: number, color: string, light: { x: number; y: number }): void {
  if (setting === 'none') return;
  const m = Math.min(w, h);
  const trace = (pts: { x: number; y: number }[]) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  };
  if (setting === 'bezel') {
    if (part === 'back') {
      trace(scalePts(outline, 1.2));
      shadedFill(ctx, color, w * 1.2, h * 1.2, light);
    } else {
      trace(scalePts(outline, 1.02));
      ctx.strokeStyle = shade(color, 0.1);
      ctx.lineWidth = Math.max(0.6, m * 0.09);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    return;
  }
  const n = setting === 'claws4' ? 4 : 6;
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) * Math.PI * 2) / n - Math.PI / 2;
    const dx = Math.cos(a) * (w / 2);
    const dy = Math.sin(a) * (h / 2);
    if (part === 'back') {
      // A prong from beyond the girdle in under the stone.
      ctx.save();
      ctx.translate(dx * 0.88, dy * 0.88);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, m * 0.1, m * 0.26, 0, 0, Math.PI * 2);
      shadedFill(ctx, color, m * 0.2, m * 0.52, light);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.ellipse(dx * 0.86, dy * 0.86, m * 0.105, m * 0.105, 0, 0, Math.PI * 2);
      shadedFill(ctx, color, m * 0.21, m * 0.21, light);
    }
  }
}

export interface ElementStyle {
  fill: string;
  outline: string | null;
  /** Fraction of the element's height. */
  outlineWidth: number;
  rune: number;
  /** Direction the light comes from, in the element's own frame (unit vector). */
  light: { x: number; y: number };
  /** Shaded by the light (the default), or one flat colour. */
  shaded?: boolean;
  /** How a cut gem is cut (Phase 6's brilliant if not given). */
  gem?: GemStyle;
  /** The second colour of two-part elements; null or missing = worked out from `fill`. */
  detail?: string | null;
  /** Varies some elements (Bard's notes: single or paired), 0–1; missing = the first kind. */
  variant?: number;
  /** Fill with this paint instead of `fill` (which still gives the second colour its default). */
  paint?: PaintSource | null;
  /** Set by drawElement: the paint's pattern, made for the transform at the moment of filling. */
  ink?: () => CanvasPattern;
}

/** What an element's main part is filled or drawn with: its paint, or its colour. */
const body = (style: ElementStyle): string | CanvasPattern => (style.ink ? style.ink() : style.fill);

/** A shaded ball (beads, irises, hubs): the engine's sphere, or the paint with the sphere's light and shade over it. */
function ball(ctx: Ctx, x: number, y: number, r: number, style: ElementStyle): void {
  if (!style.ink) return sphere(ctx, x, y, r, style.fill, style.light);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = style.ink();
  ctx.fill();
  const glint = ctx.createRadialGradient(x + style.light.x * r * 0.45, y + style.light.y * r * 0.45, r * 0.08, x, y, r);
  glint.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  glint.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  glint.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  glint.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.save();
  noShadow(ctx);
  ctx.fillStyle = glint;
  ctx.fill();
  ctx.restore();
}

const iconPaths = new Map<string, Path2D>();
const ICONS = new Map<string, IconGlyph>(ICON_GLYPHS.map((g) => [g.id, g]));

/** A game-icons.net ornament: its path (in a 512 box) stretched to the element, shaded like the others. */
function drawIcon(ctx: Ctx, icon: IconGlyph, w: number, h: number, style: ElementStyle): void {
  let path = iconPaths.get(icon.id);
  if (!path) {
    path = new Path2D(icon.d);
    iconPaths.set(icon.id, path);
  }
  ctx.save();
  ctx.scale(w / 512, h / 512);
  ctx.translate(-256, -256);
  shadedFill(ctx, body(style), 512, 512, style.light, 'nonzero', style.shaded, path, 256, 256);
  if (style.outline && style.outlineWidth > 0) {
    noShadow(ctx);
    ctx.strokeStyle = style.outline;
    // In the 512 box, so the outline comes out `outlineWidth` of the element's height.
    ctx.lineWidth = Math.max(0.5, h * style.outlineWidth) * (512 / h);
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }
  ctx.restore();
}

/** Token Maker's Bard note: a head and stem, single with a flag or paired with a beam. `u` is Token Maker's band width × 2.5. */
function bardNote(ctx: Ctx, h: number, stretch: number, style: ElementStyle): void {
  const u = h / 0.4;
  const paired = (style.variant ?? 1) < 0.4;
  ctx.save();
  ctx.scale(stretch, 1);
  ctx.fillStyle = body(style);
  ctx.strokeStyle = body(style);
  ctx.lineWidth = u * 0.035;
  for (const x of paired ? [-u * 0.1, u * 0.1] : [0]) {
    ctx.beginPath();
    ctx.ellipse(x, u * 0.1, u * 0.07, u * 0.05, -0.4, 0, Math.PI * 2);
    if (style.shaded) shadedFill(ctx, body(style), u * 0.14, u * 0.1, style.light);
    else ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + u * 0.06, u * 0.09);
    ctx.lineTo(x + u * 0.06, -u * 0.2);
    ctx.stroke();
  }
  ctx.beginPath();
  if (paired) {
    ctx.moveTo(-u * 0.04, -u * 0.2);
    ctx.lineTo(u * 0.16, -u * 0.2);
    ctx.lineWidth = u * 0.06;
  } else {
    ctx.moveTo(u * 0.06, -u * 0.2);
    ctx.quadraticCurveTo(u * 0.18, -u * 0.12, u * 0.14, -u * 0.02);
  }
  ctx.stroke();
  ctx.restore();
}

/** Token Maker's Warlock eye: a veined white, a shaded iris in the element's colour looking inwards, the pupil, a glint and a dark rim. */
function watchEye(ctx: Ctx, w: number, h: number, style: ElementStyle): void {
  const r = h / 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = style.detail ?? '#f2ead8';
  ctx.fill();
  // Only the white casts the shadow.
  noShadow(ctx);
  const veins = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.3);
  veins.addColorStop(0, 'rgba(255, 255, 255, 0)');
  veins.addColorStop(1, 'rgba(120, 20, 20, 0.45)');
  ctx.fillStyle = veins;
  ctx.fill();
  if (style.shaded === false) {
    ctx.beginPath();
    ctx.arc(0, r * 0.3, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = body(style);
    ctx.fill();
  } else ball(ctx, 0, r * 0.3, r * 0.6, style);
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.35, r * 0.15, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(-r * 0.2, r * 0.05, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  if (style.outlineWidth > 0) {
    ctx.strokeStyle = style.outline ?? 'rgba(20, 0, 10, 0.85)';
    ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Token Maker's Artificer cog: eight teeth, a hub (shaded, unless flat) and a dark hole. */
function cog(ctx: Ctx, h: number, stretch: number, style: ElementStyle): void {
  const r = h / 2 / 1.3;
  ctx.save();
  ctx.scale(stretch, 1);
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.3;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  // A flat cog (as Token Maker's) with a domed hub.
  ctx.fillStyle = body(style);
  ctx.fill();
  if (style.outline && style.outlineWidth > 0) {
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  noShadow(ctx);
  const hub = style.detail ?? shade(style.fill, -0.15);
  if (style.shaded === false) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = hub;
    ctx.fill();
  } else sphere(ctx, 0, 0, r * 0.8, hub, style.light);
  ctx.fillStyle = shade(hub, -0.7);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Token Maker's Druid leaf: growing from the element's point along the band, tilted outwards. */
function sprig(ctx: Ctx, h: number, stretch: number, style: ElementStyle): void {
  const tilt = -0.9;
  const bulge = (0.12 / 0.36) * h * stretch;
  ctx.save();
  ctx.rotate(tilt);
  ctx.translate(h / 2, 0);
  ctx.beginPath();
  ctx.moveTo(-h / 2, 0);
  ctx.quadraticCurveTo(-h / 2 + h * 0.472, bulge, h / 2, 0);
  ctx.quadraticCurveTo(-h / 2 + h * 0.472, -bulge, -h / 2, 0);
  ctx.closePath();
  shadedFill(ctx, body(style), h, bulge, turn(style.light, -tilt), 'nonzero', style.shaded);
  if (style.outline && style.outlineWidth > 0) {
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
    ctx.stroke();
  }
  ctx.restore();
}

/** Ranger's fletching: an open chevron pointing along the band, drawn as a line. */
function fletching(ctx: Ctx, w: number, h: number, style: ElementStyle): void {
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(-w / 2, h / 2);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = body(style);
  ctx.lineWidth = Math.max(0.5, h * Math.max(0.02, style.outlineWidth));
  ctx.stroke();
}

/** One of the path-drawn ornaments (glyphs.ts): its body, its detail in the second colour, its outline. */
function drawGlyph(ctx: Ctx, glyph: Glyph, w: number, h: number, style: ElementStyle): void {
  const x = w / 2;
  const y = h / 2;
  const lineWidth = Math.max(0.5, h * Math.max(0.03, style.outlineWidth) * (glyph.weight ?? 1));
  if (glyph.lines) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (glyph.edged) {
      // A darker edge under the line, like a cord.
      traceGlyph(ctx, glyph.lines, x, y, false);
      ctx.strokeStyle = style.detail ?? shade(style.fill, -0.6);
      ctx.lineWidth = lineWidth * 1.6;
      ctx.stroke();
      noShadow(ctx);
    }
    traceGlyph(ctx, glyph.lines, x, y, false);
    ctx.strokeStyle = body(style);
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    return;
  }
  traceGlyph(ctx, glyph.body!, x, y, true);
  shadedFill(ctx, body(style), w, h, style.light, 'nonzero', style.shaded);
  if (glyph.detail || glyph.detailLines) {
    // Only the body casts the shadow.
    noShadow(ctx);
    const color = style.detail ?? shade(style.fill, glyph.detailShade ?? -0.5);
    if (glyph.detail) {
      traceGlyph(ctx, glyph.detail, x, y, true);
      shadedFill(ctx, color, w, h, style.light, 'nonzero', style.shaded);
    }
    if (glyph.detailLines) {
      traceGlyph(ctx, glyph.detailLines, x, y, false);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, h * 0.045);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  if (style.outline && style.outlineWidth > 0) {
    noShadow(ctx);
    traceGlyph(ctx, glyph.body!, x, y, true);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function drawElement(ctx: Ctx, kind: ElementKind, h: number, stretch: number, style: ElementStyle): void {
  const w = h * stretch;
  if (h <= 0) return;
  if (style.paint) {
    const frame = ctx.getTransform();
    const paint = style.paint;
    style = { ...style, ink: () => paintPattern(ctx, paint, frame, w, h) };
  }
  const icon = ICONS.get(kind);
  if (icon) return drawIcon(ctx, icon, w, h, style);
  const glyph = GLYPHS[kind];
  if (glyph) return drawGlyph(ctx, glyph, w, h, style);
  switch (kind) {
    case 'bardNote':
      return bardNote(ctx, h, stretch, style);
    case 'watchEye':
      return watchEye(ctx, w, h, style);
    case 'cog':
      return cog(ctx, h, stretch, style);
    case 'sprig':
      return sprig(ctx, h, stretch, style);
    case 'fletching':
      return fletching(ctx, w, h, style);
  }
  if (kind === 'note') {
    traceNote(ctx, w, h, style.rune % 2 === 1);
    shadedFill(ctx, body(style), w, h, style.light, 'nonzero', style.shaded);
    if (style.outline && style.outlineWidth > 0) {
      ctx.strokeStyle = style.outline;
      ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
      ctx.stroke();
    }
    return;
  }
  if (kind === 'gash') {
    // Three claw gashes, as Token Maker's Barbarian draws them: a dark cut with a thin light edge.
    const u = h / 1.65;
    ctx.save();
    ctx.scale(1.7 * stretch, 1.5);
    ctx.lineCap = 'round';
    const alpha = ctx.globalAlpha;
    for (const dx of [-0.16, 0, 0.16]) {
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = body(style);
      ctx.lineWidth = u * 0.09;
      ctx.beginPath();
      ctx.moveTo(dx * u, -u * 0.55);
      ctx.quadraticCurveTo(dx * u + u * 0.05, 0, dx * u, u * 0.55);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = style.detail ?? style.outline ?? shade(style.fill, 0.5);
      ctx.lineWidth = u * 0.02;
      ctx.beginPath();
      ctx.moveTo(dx * u - u * 0.04, -u * 0.5);
      ctx.quadraticCurveTo(dx * u + u * 0.01, 0, dx * u - u * 0.04, u * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (kind === 'rune') {
    const strokes = RUNES[style.rune % RUNES.length];
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of strokes) {
      ctx.moveTo((x0 * w) / 2, (y0 * h) / 2);
      ctx.lineTo((x1 * w) / 2, (y1 * h) / 2);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = body(style);
    ctx.lineWidth = Math.max(1, h * Math.max(0.08, style.outlineWidth));
    ctx.stroke();
    return;
  }
  if (kind === 'bead') {
    ctx.save();
    ctx.scale(stretch, 1);
    if (style.shaded === false) {
      ctx.beginPath();
      ctx.arc(0, 0, h / 2, 0, Math.PI * 2);
      ctx.fillStyle = body(style);
      ctx.fill();
    } else ball(ctx, 0, 0, h / 2, style);
    ctx.restore();
  } else if (kind === 'eye') {
    // White of the eye, then the iris in the element's colour, looking inwards, and the pupil.
    trace(ctx, kind, w, h);
    shadedFill(ctx, '#f1e9d6', w, h, style.light, 'nonzero', style.shaded);
    ctx.save();
    ctx.clip();
    const r = Math.min(w, h) * 0.3;
    ctx.beginPath();
    ctx.arc(0, h * 0.08, r, 0, Math.PI * 2);
    shadedFill(ctx, body(style), r * 2, r * 2, style.light, 'nonzero', style.shaded);
    ctx.beginPath();
    ctx.ellipse(0, h * 0.08, r * 0.38, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0a08';
    ctx.fill();
    ctx.restore();
  } else if (kind === 'gem' && style.gem && !style.ink) {
    drawGem(ctx, style.gem, w, h, style.fill, style.light, style.shaded !== false);
    if (style.outline && style.outlineWidth > 0) {
      ctx.beginPath();
      gemOutline(style.gem, w, h).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.strokeStyle = style.outline;
      ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    return;
  } else if (facetedOutline(kind, w, h) && style.shaded !== false && !style.ink) {
    const f = facetedOutline(kind, w, h)!;
    // The outline first (it casts any shadow), then the faces over it.
    trace(ctx, kind, w, h);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.save();
    ctx.shadowColor = 'transparent';
    drawFacets(ctx, f.pts, style.fill, style.light, f.table, f.depth);
    ctx.restore();
  } else {
    trace(ctx, kind, w, h);
    // Lit from the stage's light (the top left unless it was moved).
    shadedFill(ctx, body(style), w, h, style.light, kind === 'gear' ? 'evenodd' : 'nonzero', style.shaded);
  }
  if (style.outline && style.outlineWidth > 0) {
    trace(ctx, kind, w, h);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
