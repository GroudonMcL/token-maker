// The shapes a Repeated shapes layer can use. Each is drawn centred on the
// origin in a point's local frame (+x along the band, +y in towards the
// token's centre), `h` pixels tall and `h * stretch` wide.

import { shade } from '../../render/color';
import { seededRandom, sphere } from '../../render/frameKit';
import type { ElementKind } from '../project/types';
import type { Ctx } from './canvas';

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
};

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
    case 'note':
    case 'rune':
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
