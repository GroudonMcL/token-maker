// The decoration library (DESIGN.md §6.9), drawn by code so there is nothing
// to license. Each painter draws one picture in a box `aspect × 100` units
// high (width = aspect × 100), upright as it sits at the top of the token
// and facing outwards, in the given tint. Everything is lit from the top
// left, like the frames.

import type { DecorationKind } from '../document/types';
import { mix, rgba, shade } from './color';
import type { Ctx } from './frameKit';

type Painter = (c: Ctx, color: string, w: number) => void;

type Op = [keyof Shape & string, number[]];

/**
 * A path that can be traced again and again (Shape isn't in every canvas
 * the renderer runs on, such as the one the tests use).
 */
class Shape {
  private ops: Op[] = [];
  moveTo(...a: number[]) {
    this.ops.push(['moveTo', a]);
  }
  lineTo(...a: number[]) {
    this.ops.push(['lineTo', a]);
  }
  quadraticCurveTo(...a: number[]) {
    this.ops.push(['quadraticCurveTo', a]);
  }
  bezierCurveTo(...a: number[]) {
    this.ops.push(['bezierCurveTo', a]);
  }
  ellipse(...a: number[]) {
    this.ops.push(['ellipse', a]);
  }
  closePath() {
    this.ops.push(['closePath', []]);
  }
  trace(c: Ctx): void {
    c.beginPath();
    for (const [op, a] of this.ops) {
      if (op === 'ellipse') {
        // A new sub-path for each ellipse, as Shape does.
        c.moveTo(a[0]! + a[2]! * Math.cos(a[4]!), a[1]! + a[2]! * Math.sin(a[4]!));
        c.ellipse(a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!);
      } else (c[op as 'lineTo'] as (...v: number[]) => void)(...a);
    }
  }
}

const fillShape = (c: Ctx, p: Shape, rule?: CanvasFillRule) => {
  p.trace(c);
  if (rule) c.fill(rule);
  else c.fill();
};
const strokeShape = (c: Ctx, p: Shape) => {
  p.trace(c);
  c.stroke();
};

/** A fill lit from the top left: light, the colour, then dark. */
function lit(c: Ctx, color: string, x0: number, y0: number, x1: number, y1: number, light = 0.45, dark = 0.5): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(color, light));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -dark));
  return g;
}

/** Fills a path and draws a dark outline round it. */
function finish(c: Ctx, path: Shape, fill: string | CanvasGradient, color: string, line = 2.5): void {
  c.fillStyle = fill;
  fillShape(c, path);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = line;
  c.strokeStyle = rgba(shade(color, -0.75), 0.9);
  strokeShape(c, path);
}

function poly(points: number[]): Shape {
  const p = new Shape();
  for (let i = 0; i < points.length; i += 2) {
    if (i) p.lineTo(points[i]!, points[i + 1]!);
    else p.moveTo(points[i]!, points[i + 1]!);
  }
  p.closePath();
  return p;
}

function ellipse(x: number, y: number, rx: number, ry: number, rot = 0): Shape {
  const p = new Shape();
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

/** A small white gleam. */
function gleam(c: Ctx, x: number, y: number, r: number, alpha = 0.8): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

const GOLD = '#d9ab45';
const WOOD = '#7a4a26';

const gem: Painter = (c, color) => {
  const outline = poly([20, 8, 60, 8, 78, 32, 40, 96, 2, 32]);
  finish(c, outline, color, color, 3);
  const facets: [number[], number][] = [
    [[20, 8, 60, 8, 52, 32, 28, 32], 0.45],
    [[2, 32, 20, 8, 28, 32], 0.25],
    [[60, 8, 78, 32, 52, 32], 0.05],
    [[2, 32, 28, 32, 40, 96], -0.1],
    [[28, 32, 52, 32, 40, 96], 0.12],
    [[52, 32, 78, 32, 40, 96], -0.45],
  ];
  for (const [pts, k] of facets) {
    c.fillStyle = shade(color, k);
    fillShape(c, poly(pts));
  }
  c.lineWidth = 1;
  c.strokeStyle = rgba(shade(color, 0.6), 0.5);
  for (const [pts] of facets) strokeShape(c, poly(pts));
  c.lineWidth = 3;
  c.strokeStyle = rgba(shade(color, -0.75), 0.9);
  strokeShape(c, outline);
  gleam(c, 30, 18, 10);
};

const roundGem: Painter = (c, color) => {
  finish(c, ellipse(50, 50, 46, 46), lit(c, GOLD, 10, 10, 90, 90), GOLD, 3);
  c.lineWidth = 2;
  c.strokeStyle = rgba(shade(GOLD, 0.5), 0.6);
  strokeShape(c, ellipse(50, 50, 40, 40));
  const g = c.createRadialGradient(38, 36, 2, 50, 52, 38);
  g.addColorStop(0, shade(color, 0.6));
  g.addColorStop(0.35, color);
  g.addColorStop(1, shade(color, -0.6));
  finish(c, ellipse(50, 50, 35, 35), g, color, 2);
  gleam(c, 38, 36, 11, 0.9);
};

const crown: Painter = (c, color) => {
  const body = poly([8, 88, 4, 30, 32, 58, 65, 10, 98, 58, 126, 30, 122, 88]);
  finish(c, body, lit(c, color, 0, 10, 130, 90), color, 3);
  finish(c, poly([6, 74, 124, 74, 122, 96, 8, 96]), lit(c, color, 0, 74, 0, 96, 0.3, 0.6), color, 3);
  for (const [x, y, r] of [[4, 28, 6], [65, 8, 7], [126, 28, 6]] as const) finish(c, ellipse(x, y, r, r), lit(c, color, x - r, y - r, x + r, y + r), color, 2);
  for (const [x, k] of [[30, '#c0263a'], [65, '#2f7fd8'], [100, '#2fae5a']] as const) {
    finish(c, ellipse(x, 85, 7, 7), lit(c, k, x - 7, 78, x + 7, 92), k, 1.5);
    gleam(c, x - 2, 83, 4);
  }
};

const star: Painter = (c, color) => {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 20 : 48;
    pts.push(50 + r * Math.cos(a), 52 + r * Math.sin(a));
  }
  const outline = poly(pts);
  finish(c, outline, color, color, 3);
  // Each point has a lit half and a shaded half, so the star looks bevelled.
  for (let i = 0; i < 10; i++) {
    const a = pts.slice(i * 2, i * 2 + 2);
    const b = pts.slice(((i + 1) % 10) * 2, ((i + 1) % 10) * 2 + 2);
    const facing = Math.cos(Math.atan2((a[1]! + b[1]!) / 2 - 52, (a[0]! + b[0]!) / 2 - 50) - (-3 * Math.PI) / 4);
    c.fillStyle = shade(color, facing * 0.45);
    fillShape(c, poly([50, 52, a[0]!, a[1]!, b[0]!, b[1]!]));
  }
  c.lineWidth = 3;
  c.strokeStyle = rgba(shade(color, -0.75), 0.9);
  strokeShape(c, outline);
  gleam(c, 42, 38, 9, 0.7);
};

const skull: Painter = (c, color, w) => {
  const head = new Shape();
  head.moveTo(10, 50);
  head.bezierCurveTo(4, 12, 81, 12, 75, 50);
  head.bezierCurveTo(74, 62, 66, 66, 64, 72);
  head.lineTo(64, 92);
  head.quadraticCurveTo(w / 2, 100, 21, 92);
  head.lineTo(21, 72);
  head.bezierCurveTo(19, 66, 11, 62, 10, 50);
  head.closePath();
  finish(c, head, lit(c, color, 5, 10, 80, 100, 0.35, 0.45), color, 3);
  const hole = shade(color, -0.85);
  c.fillStyle = hole;
  fillShape(c, ellipse(28, 52, 10, 11, 0.2));
  fillShape(c, ellipse(57, 52, 10, 11, -0.2));
  fillShape(c, poly([42.5, 62, 37, 74, 48, 74]));
  c.strokeStyle = rgba(hole, 0.85);
  c.lineWidth = 2;
  for (const x of [30, 37, 44.5, 52, 58]) {
    c.beginPath();
    c.moveTo(x, 80);
    c.lineTo(x, 92);
    c.stroke();
  }
  gleam(c, 26, 28, 12, 0.45);
};

const horn: Painter = (c, color) => {
  // A curved horn: base at the bottom right, tip at the top left.
  const p = new Shape();
  p.moveTo(22, 98);
  p.bezierCurveTo(20, 60, 8, 34, 6, 3);
  p.bezierCurveTo(30, 26, 56, 52, 56, 98);
  p.closePath();
  finish(c, p, lit(c, color, 0, 0, 60, 100, 0.4, 0.55), color, 2.5);
  // Ridges across the horn.
  c.save();
  p.trace(c);
  c.clip();
  c.strokeStyle = rgba(shade(color, -0.6), 0.55);
  c.lineWidth = 1.6;
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    const y = 98 - t * 92;
    c.beginPath();
    c.moveTo(0, y + 6);
    c.quadraticCurveTo(30, y - 4, 60, y + 4);
    c.stroke();
  }
  c.restore();
  c.fillStyle = rgba(shade(color, -0.7), 0.6);
  fillShape(c, ellipse(39, 97, 17, 3));
};

const wing: Painter = (c, color) => {
  // Feathers fan out from the root (bottom right) up and to the left.
  const root = { x: 62, y: 92 };
  const feathers = [
    { a: -100, len: 92, wid: 9 },
    { a: -115, len: 88, wid: 9 },
    { a: -130, len: 80, wid: 9 },
    { a: -145, len: 70, wid: 9 },
    { a: -160, len: 58, wid: 8 },
    { a: -174, len: 46, wid: 8 },
  ];
  for (const [i, f] of [...feathers].reverse().entries()) {
    const a = (f.a * Math.PI) / 180;
    const cx = root.x + (Math.cos(a) * f.len) / 2;
    const cy = root.y + (Math.sin(a) * f.len) / 2;
    finish(c, ellipse(cx, cy, f.len / 2, f.wid, a), lit(c, shade(color, -0.08 * (feathers.length - 1 - i)), cx - 20, cy - 20, cx + 20, cy + 20, 0.35, 0.4), color, 1.8);
    c.strokeStyle = rgba(shade(color, -0.55), 0.6);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(root.x, root.y);
    c.lineTo(root.x + Math.cos(a) * f.len * 0.95, root.y + Math.sin(a) * f.len * 0.95);
    c.stroke();
  }
  // The covert feathers over the root.
  const cov = new Shape();
  cov.moveTo(root.x + 12, root.y + 4);
  cov.bezierCurveTo(70, 50, 40, 30, 22, 46);
  cov.bezierCurveTo(30, 60, 40, 80, root.x + 12, root.y + 4);
  cov.closePath();
  finish(c, cov, lit(c, color, 20, 30, 80, 100, 0.5, 0.3), color, 2);
};

const ribbon: Painter = (c, color) => {
  const dark = shade(color, -0.45);
  // Tails behind, with a notch, then the folds, then the front band.
  finish(c, poly([4, 44, 30, 44, 30, 86, 4, 86, 15, 65]), lit(c, dark, 0, 40, 30, 90), color, 2.5);
  finish(c, poly([156, 44, 130, 44, 130, 86, 156, 86, 145, 65]), lit(c, dark, 130, 40, 160, 90), color, 2.5);
  c.fillStyle = shade(color, -0.7);
  fillShape(c, poly([30, 70, 42, 70, 30, 86]));
  fillShape(c, poly([130, 70, 118, 70, 130, 86]));
  const band = new Shape();
  band.moveTo(24, 22);
  band.quadraticCurveTo(80, 10, 136, 22);
  band.lineTo(136, 70);
  band.quadraticCurveTo(80, 58, 24, 70);
  band.closePath();
  finish(c, band, lit(c, color, 0, 12, 0, 72, 0.35, 0.45), color, 2.5);
  c.strokeStyle = rgba(shade(color, 0.5), 0.5);
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(28, 28);
  c.quadraticCurveTo(80, 17, 132, 28);
  c.stroke();
};

const laurel: Painter = (c, color) => {
  // A branch along an arc (it lies along the ring), leaves pointing to its tip on the right.
  const arc = (t: number) => {
    const a = Math.PI * (1.18 + t * 0.64);
    return { x: 100 + 150 * Math.cos(a), y: 170 + 150 * Math.sin(a), a };
  };
  c.strokeStyle = shade(color, -0.4);
  c.lineWidth = 3;
  c.beginPath();
  for (let i = 0; i <= 30; i++) {
    const p = arc(i / 30);
    if (i) c.lineTo(p.x, p.y);
    else c.moveTo(p.x, p.y);
  }
  c.stroke();
  for (let i = 0; i < 9; i++) {
    const p = arc(0.06 + (i / 9) * 0.9);
    const along = p.a + Math.PI / 2;
    for (const side of [-1, 1]) {
      const tilt = along + side * 0.6;
      const len = 15 - i * 0.6;
      const x = p.x + Math.cos(tilt) * len;
      const y = p.y + Math.sin(tilt) * len;
      finish(c, ellipse(x, y, len, 5.5, tilt), lit(c, color, x - 10, y - 10, x + 10, y + 10, 0.35, 0.4), color, 1.5);
    }
  }
  const tip = arc(1);
  finish(c, ellipse(tip.x + 6, tip.y + 2, 10, 5, tip.a + Math.PI / 2), lit(c, color, tip.x - 5, tip.y - 8, tip.x + 15, tip.y + 10), color, 1.5);
};

const chain: Painter = (c, color) => {
  // Links alternate: one seen face-on (an oval ring), one edge-on (a bar).
  const links = 6;
  const step = 300 / links;
  for (let i = 0; i < links; i++) {
    const x = step / 2 + i * step;
    if (i % 2) {
      finish(c, poly([x - step * 0.62, 43, x + step * 0.62, 43, x + step * 0.62, 57, x - step * 0.62, 57]), lit(c, color, 0, 40, 0, 60, 0.5, 0.5), color, 2.5);
    } else {
      const ring = new Shape();
      ring.ellipse(x, 50, step * 0.62, 40, 0, 0, Math.PI * 2);
      ring.ellipse(x, 50, step * 0.62 - 12, 26, 0, 0, Math.PI * 2);
      c.fillStyle = lit(c, color, x - 30, 10, x + 30, 90);
      fillShape(c, ring, 'evenodd');
      c.lineWidth = 2.5;
      c.strokeStyle = rgba(shade(color, -0.75), 0.9);
      strokeShape(c, ring);
    }
  }
  // Edge-on links sit over the face-on ones they pass through.
  for (let i = 1; i < links; i += 2) {
    const x = step / 2 + i * step;
    finish(c, poly([x - step * 0.62, 43, x + step * 0.62, 43, x + step * 0.62, 57, x - step * 0.62, 57]), lit(c, color, 0, 40, 0, 60, 0.5, 0.5), color, 2.5);
  }
};

const leaf: Painter = (c, color) => {
  const p = new Shape();
  p.moveTo(30, 86);
  p.bezierCurveTo(-4, 60, 6, 20, 30, 2);
  p.bezierCurveTo(54, 20, 64, 60, 30, 86);
  p.closePath();
  finish(c, p, lit(c, color, 0, 0, 60, 90, 0.35, 0.45), color, 2.5);
  c.strokeStyle = rgba(shade(color, -0.55), 0.8);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(30, 98);
  c.lineTo(30, 8);
  for (let i = 0; i < 5; i++) {
    const y = 76 - i * 14;
    c.moveTo(30, y);
    c.lineTo(14, y - 10);
    c.moveTo(30, y);
    c.lineTo(46, y - 10);
  }
  c.stroke();
};

/** A blade with a crossguard, grip and pommel; `blade` is how much of the height the blade takes. */
function bladed(c: Ctx, color: string, blade: number, curvedGuard: boolean): void {
  const guardY = blade * 100;
  finish(c, poly([15, 2, 23, 14, 22, guardY, 8, guardY, 7, 14]), lit(c, color, 0, 0, 30, 0, 0.55, 0.45), color, 2);
  c.strokeStyle = rgba(shade(color, -0.5), 0.6);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(15, 8);
  c.lineTo(15, guardY - 2);
  c.stroke();
  const guard = curvedGuard ? new Shape() : poly([1, guardY - 1, 29, guardY - 1, 29, guardY + 6, 1, guardY + 6]);
  if (curvedGuard) {
    guard.moveTo(1, guardY - 6);
    guard.quadraticCurveTo(15, guardY + 2, 29, guardY - 6);
    guard.lineTo(29, guardY + 1);
    guard.quadraticCurveTo(15, guardY + 9, 1, guardY + 1);
    guard.closePath();
  }
  finish(c, guard, lit(c, GOLD, 0, guardY - 6, 0, guardY + 8), GOLD, 2);
  const gripEnd = 92;
  finish(c, poly([11, guardY + 6, 19, guardY + 6, 19, gripEnd, 11, gripEnd]), lit(c, WOOD, 10, 0, 20, 0, 0.3, 0.5), WOOD, 2);
  c.strokeStyle = rgba(shade(WOOD, -0.7), 0.7);
  c.lineWidth = 1;
  for (let y = guardY + 10; y < gripEnd; y += 4) {
    c.beginPath();
    c.moveTo(11, y);
    c.lineTo(19, y + 2);
    c.stroke();
  }
  finish(c, ellipse(15, 95, 5.5, 4.5), lit(c, GOLD, 10, 90, 20, 100), GOLD, 2);
}

const sword: Painter = (c, color) => bladed(c, color, 0.7, false);
const dagger: Painter = (c, color) => bladed(c, color, 0.55, true);

const shield: Painter = (c, color) => {
  const p = new Shape();
  p.moveTo(4, 8);
  p.quadraticCurveTo(42.5, -2, 81, 8);
  p.lineTo(81, 46);
  p.quadraticCurveTo(78, 80, 42.5, 98);
  p.quadraticCurveTo(7, 80, 4, 46);
  p.closePath();
  finish(c, p, lit(c, GOLD, 0, 0, 85, 100), GOLD, 3);
  c.save();
  c.translate(42.5, 50);
  c.scale(0.84, 0.86);
  c.translate(-42.5, -50);
  finish(c, p, lit(c, color, 0, 0, 85, 100, 0.35, 0.5), color, 2);
  c.restore();
  // A cross on the field.
  finish(c, poly([37, 18, 48, 18, 48, 40, 64, 40, 64, 51, 48, 51, 48, 80, 37, 80, 37, 51, 21, 51, 21, 40, 37, 40]), lit(c, GOLD, 20, 18, 64, 80), GOLD, 1.5);
  gleam(c, 22, 18, 12, 0.35);
};

const staff: Painter = (c, color) => {
  const shaft = new Shape();
  shaft.moveTo(12.5, 30);
  shaft.quadraticCurveTo(10, 65, 13, 99);
  shaft.lineTo(18, 99);
  shaft.quadraticCurveTo(20, 65, 17.5, 30);
  shaft.closePath();
  finish(c, shaft, lit(c, WOOD, 8, 0, 22, 0), WOOD, 2);
  // Claws holding the orb.
  c.strokeStyle = shade(WOOD, -0.3);
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(15, 32);
  c.quadraticCurveTo(3, 28, 4, 14);
  c.moveTo(15, 32);
  c.quadraticCurveTo(27, 28, 26, 14);
  c.stroke();
  const g = c.createRadialGradient(11, 13, 1, 15, 17, 13);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, shade(color, 0.3));
  g.addColorStop(1, shade(color, -0.45));
  finish(c, ellipse(15, 17, 12, 12), g, color, 2);
  gleam(c, 11, 12, 6, 0.9);
};

const bow: Painter = (c, color) => {
  const limb = new Shape();
  limb.moveTo(34, 2);
  limb.bezierCurveTo(2, 20, 2, 80, 34, 98);
  limb.lineTo(38, 94);
  limb.bezierCurveTo(12, 78, 12, 22, 38, 6);
  limb.closePath();
  finish(c, limb, lit(c, color, 0, 0, 40, 0, 0.35, 0.45), color, 2);
  c.strokeStyle = 'rgba(240, 236, 224, 0.9)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(36, 4);
  c.lineTo(36, 96);
  c.stroke();
  finish(c, poly([7, 42, 15, 42, 15, 58, 7, 58]), lit(c, '#5a3a22', 6, 0, 16, 0), '#5a3a22', 1.5);
};

const holySymbol: Painter = (c, color) => {
  const rays = new Shape();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const b = 0.16;
    const r = i % 2 ? 40 : 48;
    rays.moveTo(50 + 24 * Math.cos(a - b), 50 + 24 * Math.sin(a - b));
    rays.lineTo(50 + r * Math.cos(a), 50 + r * Math.sin(a));
    rays.lineTo(50 + 24 * Math.cos(a + b), 50 + 24 * Math.sin(a + b));
    rays.closePath();
  }
  finish(c, rays, lit(c, color, 0, 0, 100, 100), color, 2);
  finish(c, ellipse(50, 50, 27, 27), lit(c, color, 25, 25, 75, 75, 0.5, 0.5), color, 2.5);
  finish(c, ellipse(50, 50, 16, 16), lit(c, mix(color, '#ffffff', 0.4), 34, 34, 66, 66), color, 1.5);
  gleam(c, 42, 40, 10, 0.7);
};

const lute: Painter = (c, color) => {
  // Neck and pegbox, then the round body.
  finish(c, poly([21, 46, 29, 46, 28, 14, 22, 14]), lit(c, shade(color, -0.35), 20, 0, 30, 0), color, 1.5);
  finish(c, poly([21, 15, 29, 15, 36, 3, 28, 1]), lit(c, shade(color, -0.4), 20, 0, 36, 0), color, 1.5);
  const body = new Shape();
  body.moveTo(25, 40);
  body.bezierCurveTo(48, 44, 50, 98, 25, 98);
  body.bezierCurveTo(0, 98, 2, 44, 25, 40);
  body.closePath();
  finish(c, body, lit(c, color, 0, 40, 50, 100, 0.4, 0.5), color, 2.5);
  c.fillStyle = shade(color, -0.8);
  fillShape(c, ellipse(25, 66, 7, 7));
  finish(c, poly([18, 84, 32, 84, 32, 88, 18, 88]), shade(color, -0.55), color, 1);
  c.strokeStyle = 'rgba(240, 236, 224, 0.75)';
  c.lineWidth = 0.7;
  for (const x of [23, 25, 27]) {
    c.beginPath();
    c.moveTo(x, 18);
    c.lineTo(x, 86);
    c.stroke();
  }
};

export const DECORATION_PAINTERS: Record<DecorationKind, Painter> = {
  gem,
  roundGem,
  crown,
  star,
  skull,
  horn,
  wing,
  ribbon,
  laurel,
  chain,
  leaf,
  sword,
  dagger,
  shield,
  staff,
  bow,
  holySymbol,
  lute,
  // Picture decorations are drawn from their picture (decorations.ts), not by code.
  picture: () => {},
};
