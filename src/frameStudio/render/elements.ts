// The shapes a Repeated shapes layer can use. Each is drawn centred on the
// origin in a point's local frame (+x along the band, +y in towards the
// token's centre), `h` pixels tall and `h * stretch` wide.

import { shade } from '../../render/color';
import { seededRandom, sphere } from '../../render/frameKit';
import type { ElementKind, GemCut, GemSetting } from '../project/types';
import type { Ctx } from './canvas';
import { drawFacets } from './facets';

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
};

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

/** Fills the current path with `color`, brighter towards the light and darker away from it (or flat, if not `shaded`). */
export function shadedFill(ctx: Ctx, color: string, w: number, h: number, light: { x: number; y: number }, rule: CanvasFillRule = 'nonzero', shaded = true): void {
  if (!shaded) {
    ctx.fillStyle = color;
    ctx.fill(rule);
    return;
  }
  const { x, y } = light;
  const gradient = ctx.createLinearGradient((x * w) / 2, (y * h) / 2, (-x * w) / 2, (-y * h) / 2);
  gradient.addColorStop(0, shade(color, 0.25));
  gradient.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = gradient;
  ctx.fill(rule);
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
}

export function drawElement(ctx: Ctx, kind: ElementKind, h: number, stretch: number, style: ElementStyle): void {
  const w = h * stretch;
  if (h <= 0) return;
  if (kind === 'note') {
    traceNote(ctx, w, h, style.rune % 2 === 1);
    shadedFill(ctx, style.fill, w, h, style.light, 'nonzero', style.shaded);
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
      ctx.strokeStyle = style.fill;
      ctx.lineWidth = u * 0.09;
      ctx.beginPath();
      ctx.moveTo(dx * u, -u * 0.55);
      ctx.quadraticCurveTo(dx * u + u * 0.05, 0, dx * u, u * 0.55);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = style.outline ?? shade(style.fill, 0.5);
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
    ctx.strokeStyle = style.fill;
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
      ctx.fillStyle = style.fill;
      ctx.fill();
    } else sphere(ctx, 0, 0, h / 2, style.fill, style.light);
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
    shadedFill(ctx, style.fill, r * 2, r * 2, style.light, 'nonzero', style.shaded);
    ctx.beginPath();
    ctx.ellipse(0, h * 0.08, r * 0.38, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0a08';
    ctx.fill();
    ctx.restore();
  } else if (kind === 'gem' && style.gem) {
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
  } else if (facetedOutline(kind, w, h) && style.shaded !== false) {
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
    shadedFill(ctx, style.fill, w, h, style.light, kind === 'gear' ? 'evenodd' : 'nonzero', style.shaded);
  }
  if (style.outline && style.outlineWidth > 0) {
    trace(ctx, kind, w, h);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = Math.max(0.5, h * style.outlineWidth);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
