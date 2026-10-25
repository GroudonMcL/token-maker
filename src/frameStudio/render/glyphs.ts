// The path-drawn ornaments (Phase 6): hearts, moons, flames, a fleur-de-lis
// and more, for Repeated shapes and Shape layers. Each is written like an
// SVG path in its own box, x and y from -1 to 1 (+x along the band, +y in
// towards the token's centre), and drawn stretched to the element's width
// and height. Filled parts are turned to wind the same way, so overlapping
// parts join up instead of cutting holes in each other.

import type { ElementKind } from '../project/types';
import type { Ctx } from './canvas';

/** One subpath: a start point and cubic segments [c1x, c1y, c2x, c2y, x, y]. */
interface Sub {
  start: [number, number];
  segs: number[][];
  closed: boolean;
}

export interface Glyph {
  /** Filled in the element's colour (casts the shadow). */
  body?: Sub[];
  /** Filled in the second colour, over the body. */
  detail?: Sub[];
  /** Lines in the second colour, over the body. */
  detailLines?: Sub[];
  /** How dark the second colour is by default (a shade of the main colour). */
  detailShade?: number;
  /** Drawn as lines (no body): their thickness is the outline width. */
  lines?: Sub[];
  /** Line thickness relative to the outline width. */
  weight?: number;
  /** Lines get a darker edge underneath, like a cord. */
  edged?: boolean;
}

/** Reads M, L, Q, C and Z (absolute coordinates only). */
function parse(d: string): Sub[] {
  const t = d.trim().split(/[\s,]+/);
  const subs: Sub[] = [];
  let cur: Sub | null = null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < t.length; ) {
    const cmd = t[i++];
    const n = () => Number(t[i++]);
    switch (cmd) {
      case 'M':
        x = n();
        y = n();
        cur = { start: [x, y], segs: [], closed: false };
        subs.push(cur);
        break;
      case 'L': {
        const px = n();
        const py = n();
        cur!.segs.push([x, y, px, py, px, py]);
        x = px;
        y = py;
        break;
      }
      case 'Q': {
        const qx = n();
        const qy = n();
        const px = n();
        const py = n();
        cur!.segs.push([x + ((qx - x) * 2) / 3, y + ((qy - y) * 2) / 3, px + ((qx - px) * 2) / 3, py + ((qy - py) * 2) / 3, px, py]);
        x = px;
        y = py;
        break;
      }
      case 'C': {
        const s = [n(), n(), n(), n(), n(), n()];
        cur!.segs.push(s);
        x = s[4];
        y = s[5];
        break;
      }
      case 'Z':
        cur!.closed = true;
        break;
      default:
        throw new Error(`glyph path: unknown command ${cmd}`);
    }
  }
  return subs;
}

/** Twice the signed area of a subpath's points (end points and control points: enough to tell its direction). */
function area(s: Sub): number {
  const pts: number[][] = [s.start, ...s.segs.flatMap((g) => [g.slice(0, 2), g.slice(2, 4), g.slice(4, 6)])];
  let a = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  });
  return a;
}

function reverse(s: Sub): Sub {
  const points = [s.start, ...s.segs.map((g) => [g[4], g[5]] as [number, number])];
  const segs = s.segs
    .map((g, i) => {
      const [px, py] = points[i];
      return [g[2], g[3], g[0], g[1], px, py];
    })
    .reverse();
  return { start: [s.segs.at(-1)![4], s.segs.at(-1)![5]], segs, closed: s.closed };
}

/** Filled parts all wound the same way. */
const filled = (d: string) => parse(d).map((s) => (area(s) < 0 ? reverse(s) : s));

/** A copy flipped left to right. */
const mirrored = (subs: Sub[]) =>
  subs.map((s) => ({ ...s, start: [-s.start[0], s.start[1]] as [number, number], segs: s.segs.map((g) => [-g[0], g[1], -g[2], g[3], -g[4], g[5]]) })).map((s) => (area(s) < 0 ? reverse(s) : s));

/** An ellipse as a path (four curves). */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523;
  return `M ${cx + rx} ${cy} C ${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry} C ${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy} C ${cx - rx} ${cy - ry * k} ${cx - rx * k} ${cy - ry} ${cx} ${cy - ry} C ${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy} Z`;
}

/** Points joined by straight lines. */
const polyline = (pts: number[][], close = false) => `M ${pts[0][0]} ${pts[0][1]} ${pts.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(' ')}${close ? ' Z' : ''}`;

const range = (n: number) => Array.from({ length: n }, (_x, i) => i);

/** The crescent: a disc with a bite out of its outer side, horns pointing outwards. */
function crescent(): string {
  // Outer circle r 1 at the centre; the bite is a circle r 0.82 at (0, -0.38). They cross at (±0.7837, -0.6211).
  const outer = range(25).map((i) => {
    const a = -0.6704 + (i / 24) * (Math.PI + 2 * 0.6704);
    return [Math.cos(a), Math.sin(a)];
  });
  const inner = range(25).map((i) => {
    const a = Math.PI + 0.2985 - (i / 24) * (Math.PI + 2 * 0.2985);
    return [Math.cos(a) * 0.82, -0.38 + Math.sin(a) * 0.82];
  });
  return polyline([...outer, ...inner.slice(1, -1)], true);
}

function sun(): string {
  const rays = range(12).map((i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 6;
    const p = (r: number, da: number) => [Math.cos(a + da) * r, Math.sin(a + da) * r];
    return polyline([p(0.5, -0.17), p(1, 0), p(0.5, 0.17)], true);
  });
  return [ellipse(0, 0, 0.6, 0.6), ...rays].join(' ');
}

function snowflake(): string {
  const parts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    const at = (r: number, da = 0, len = 0) => [Math.cos(a) * r + Math.cos(a + da) * len, Math.sin(a) * r + Math.sin(a + da) * len];
    parts.push(polyline([[0, 0], at(1)]));
    for (const [r, len] of [
      [0.5, 0.32],
      [0.78, 0.2],
    ])
      for (const da of [-Math.PI / 4, Math.PI / 4]) parts.push(polyline([at(r), at(r, da, len)]));
  }
  return parts.join(' ');
}

function spiral(): string {
  const turns = 2.5;
  return polyline(
    range(91).map((i) => {
      const t = i / 90;
      const a = -Math.PI / 2 + t * turns * Math.PI * 2;
      return [Math.cos(a) * t, Math.sin(a) * t];
    }),
  );
}

function trefoil(): string {
  return polyline(
    range(181).map((i) => {
      const t = (i / 180) * Math.PI * 2;
      return [(Math.sin(t) + 2 * Math.sin(2 * t)) / 3, (Math.cos(t) - 2 * Math.cos(2 * t)) / 3];
    }),
    true,
  );
}

const fleurSide = filled('M 0.1 0.15 C 0.35 -0.45 0.95 -0.55 1 -0.1 C 1 0.15 0.75 0.25 0.62 0.05 C 0.75 0 0.72 -0.22 0.55 -0.2 C 0.35 -0.17 0.28 0.05 0.25 0.25 Z');

export const GLYPHS: Partial<Record<ElementKind, Glyph>> = {
  heart: { body: filled('M 0 1 C -0.1 0.6 -1 0.2 -1 -0.4 C -1 -0.95 -0.25 -1.05 0 -0.55 C 0.25 -1.05 1 -0.95 1 -0.4 C 1 0.2 0.1 0.6 0 1 Z') },
  crescent: { body: filled(crescent()) },
  flame: {
    body: filled('M 0 -1 C 0.3 -0.55 1.05 -0.15 0.85 0.45 C 0.65 1.05 -0.65 1.05 -0.85 0.45 C -1 0 -0.55 -0.2 -0.45 -0.6 C -0.3 -0.3 -0.05 -0.45 0 -1 Z'),
    detail: filled('M 0.05 -0.25 C 0.2 0.05 0.55 0.3 0.42 0.6 C 0.3 0.92 -0.3 0.92 -0.42 0.6 C -0.52 0.3 -0.25 0.2 -0.2 -0.05 C -0.1 0.1 0 0 0.05 -0.25 Z'),
    detailShade: 0.55,
  },
  fleur: {
    body: [
      ...filled('M 0 -1 C 0.32 -0.65 0.3 -0.1 0 0.2 C -0.3 -0.1 -0.32 -0.65 0 -1 Z'),
      ...fleurSide,
      ...mirrored(fleurSide),
      ...filled('M -0.5 0.2 L 0.5 0.2 L 0.5 0.36 L -0.5 0.36 Z'),
      ...filled('M -0.12 0.36 L 0.12 0.36 C 0.15 0.6 0.35 0.75 0.42 1 C 0.25 0.85 0.1 0.8 0 0.8 C -0.1 0.8 -0.25 0.85 -0.42 1 C -0.35 0.75 -0.15 0.6 -0.12 0.36 Z'),
    ],
  },
  shield: {
    body: filled('M -1 -1 L 1 -1 L 1 -0.2 C 1 0.45 0.5 0.8 0 1 C -0.5 0.8 -1 0.45 -1 -0.2 Z'),
    detail: filled('M -0.72 -0.76 L 0.72 -0.76 L 0.72 -0.2 C 0.72 0.3 0.36 0.56 0 0.72 C -0.36 0.56 -0.72 0.3 -0.72 -0.2 Z'),
    detailShade: -0.35,
  },
  sun: { body: filled(sun()) },
  snowflake: { lines: parse(snowflake()), weight: 1.2 },
  crown: { body: filled('M -1 1 L -1 -0.45 L -0.5 0.1 L 0 -1 L 0.5 0.1 L 1 -0.45 L 1 1 Z'), detail: filled('M -1 0.55 L 1 0.55 L 1 1 L -1 1 Z'), detailShade: -0.4 },
  jewel: { body: filled('M 0 -1 L 1 -0.5 L 1 0.5 L 0 1 L -1 0.5 L -1 -0.5 Z'), detail: filled('M 0 -0.5 L 0.5 -0.25 L 0.5 0.25 L 0 0.5 L -0.5 0.25 L -0.5 -0.25 Z'), detailShade: 0.4 },
  drop: { body: filled('M 0 -1 C 0.35 -0.45 0.95 0 0.95 0.4 C 0.95 0.78 0.5 1 0 1 C -0.5 1 -0.95 0.78 -0.95 0.4 C -0.95 0 -0.35 -0.45 0 -1 Z') },
  shell: {
    body: filled('M -1 0.85 C -1 -0.3 -0.55 -1 0 -1 C 0.55 -1 1 -0.3 1 0.85 L 0.35 0.85 L 0.2 1 L -0.2 1 L -0.35 0.85 Z'),
    detailLines: parse(
      [
        [-0.78, -0.25],
        [-0.42, -0.78],
        [0, -0.92],
        [0.42, -0.78],
        [0.78, -0.25],
      ]
        .map((p) => polyline([[0, 0.9], p]))
        .join(' '),
    ),
    detailShade: -0.45,
  },
  spiral: { lines: parse(spiral()) },
  paw: {
    body: filled(
      [
        'M 0 -0.05 C 0.45 -0.05 0.75 0.4 0.6 0.75 C 0.45 1.05 -0.45 1.05 -0.6 0.75 C -0.75 0.4 -0.45 -0.05 0 -0.05 Z',
        ellipse(-0.78, -0.25, 0.2, 0.27),
        ellipse(-0.3, -0.72, 0.2, 0.27),
        ellipse(0.3, -0.72, 0.2, 0.27),
        ellipse(0.78, -0.25, 0.2, 0.27),
      ].join(' '),
    ),
  },
  feather: {
    body: filled('M 0 -1 C 0.75 -0.55 0.8 0.35 0.12 0.82 L 0.04 1 L -0.04 1 L -0.12 0.82 C -0.8 0.35 -0.75 -0.55 0 -1 Z'),
    detailLines: parse(
      [polyline([[0, -0.85], [0, 1]]), ...[-0.45, -0.1, 0.25].flatMap((y) => [polyline([[0, y], [0.5, y - 0.28]]), polyline([[0, y], [-0.5, y - 0.28]])])].join(' '),
    ),
    detailShade: -0.4,
  },
  knot: { lines: parse(trefoil()), weight: 1.6, edged: true },
  skull: {
    body: filled(
      'M 0 -1 C 0.6 -1 0.95 -0.6 0.95 -0.1 C 0.95 0.25 0.75 0.4 0.6 0.5 L 0.6 0.85 C 0.6 0.95 0.5 1 0.4 1 L -0.4 1 C -0.5 1 -0.6 0.95 -0.6 0.85 L -0.6 0.5 C -0.75 0.4 -0.95 0.25 -0.95 -0.1 C -0.95 -0.6 -0.6 -1 0 -1 Z',
    ),
    detail: filled(
      [
        ellipse(-0.38, -0.05, 0.24, 0.27),
        ellipse(0.38, -0.05, 0.24, 0.27),
        'M 0 0.25 L 0.12 0.48 L -0.12 0.48 Z',
        ...[-0.25, 0, 0.25].map((x) => polyline([[x - 0.035, 0.7], [x + 0.035, 0.7], [x + 0.035, 1], [x - 0.035, 1]], true)),
      ].join(' '),
    ),
    detailShade: -0.8,
  },
  arrow: { body: filled('M 1 0 L 0.45 -0.55 L 0.45 -0.18 L -0.6 -0.18 L -1 -0.5 L -0.8 0 L -1 0.5 L -0.6 0.18 L 0.45 0.18 L 0.45 0.55 Z') },
};

/** The glyphs drawn as lines. */
export const STROKED = (Object.keys(GLYPHS) as ElementKind[]).filter((k) => GLYPHS[k]!.lines);

/** Traces subpaths scaled to half-width `x` and half-height `y`. Filled parts are closed. */
export function traceGlyph(ctx: Ctx, subs: Sub[], x: number, y: number, fill: boolean): void {
  ctx.beginPath();
  for (const s of subs) {
    ctx.moveTo(s.start[0] * x, s.start[1] * y);
    for (const g of s.segs) ctx.bezierCurveTo(g[0] * x, g[1] * y, g[2] * x, g[3] * y, g[4] * x, g[5] * y);
    if (s.closed || fill) ctx.closePath();
  }
}
