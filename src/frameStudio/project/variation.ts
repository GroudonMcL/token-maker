// Workflow tools on a whole design (DESIGN.md §6.8): randomising it into
// variations within sensible limits, and recolouring it from one or two
// theme colours. Both work on the project data only, leave locked layers (and
// everything in a locked group) alone, and go through the file checker
// afterwards, so every number stays in its range.

import { seededRandom } from '../../render/frameKit';
import { parseProject } from './migrate';
import { PROJECT_FORMAT, SCHEMA_VERSION, type Effect, type FrameProject, type Layer } from './types';

// ---------------------------------------------------------------- colours

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

export function hexToHsl(hex: string): Hsl {
  const h6 = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const n = parseInt(h6.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = Math.min(1, Math.max(0, s));
  const ll = Math.min(1, Math.max(0, l));
  const f = (n: number) => {
    const k = (n + hh * 12) % 12;
    const a = ss * Math.min(ll, 1 - ll);
    const c = ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Keys whose strings are never colours (names, ids, text, references). */
const NOT_COLOURS = new Set(['id', 'name', 'text', 'follow', 'source', 'presetId', 'style', 'type', 'kind', 'originalType', 'reason']);

/** A copy of `value` with every colour in it (any hex string not under a name, id or text) replaced by `fn(colour)`. */
export function mapColours<T>(value: T, fn: (hex: string) => string): T {
  const walk = (v: unknown, key: string): unknown => {
    if (isHex(v) && !NOT_COLOURS.has(key)) return fn(v.toLowerCase());
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return walk(value, '') as T;
}

/** Every colour in a value (as mapColours finds them). */
export function coloursIn(value: unknown): string[] {
  const out: string[] = [];
  mapColours(value, (c) => {
    out.push(c);
    return c;
  });
  return out;
}

/** Applies `fn` to every layer that isn't locked (or inside a locked group), keeping the tree. */
function eachUnlocked(layers: Layer[], fn: (l: Layer) => Layer): Layer[] {
  return layers.map((l) => {
    if (l.locked) return l;
    if (l.type === 'group') {
      const { children, ...own } = l;
      return { ...(fn({ ...own, children: [] } as Layer) as Extract<Layer, { type: 'group' }>), children: eachUnlocked(children, fn) };
    }
    return fn(l);
  });
}

/** The project after its layers went through the file checker (every number back in its range). */
function checked(project: FrameProject): FrameProject {
  const r = parseProject(JSON.parse(JSON.stringify(project)));
  return r.ok ? r.project : project;
}

// ---------------------------------------------------------------- randomising

export interface RandomiseOptions {
  /** New seeds: textures, generators, wear, variation (patterns and arrangements). */
  patterns: boolean;
  colours: boolean;
  sizes: boolean;
  /** 0–1: how far from the design it may go. */
  strength: number;
}

export const DEFAULT_RANDOMISE: RandomiseOptions = { patterns: true, colours: true, sizes: true, strength: 0.5 };

/** Settings varied when sizes are randomised (all relative, so a variation keeps the design's proportions roughly). */
const SIZE_KEYS = new Set(['size', 'width', 'thickness', 'amplitude', 'waveAmplitude', 'branchLength', 'extraSize', 'linkLength', 'depth', 'gloss', 'surfaceDepth', 'surfaceScale', 'amount', 'scale', 'strength', 'jitter', 'gap', 'chips', 'polish', 'grime']);
/** Whole numbers varied with the sizes. */
const COUNT_KEYS = new Set(['count', 'teeth', 'spokes', 'gemFacets']);

/** Varies one layer (or a list of effects) with a random number source. */
function vary<T>(value: T, opts: RandomiseOptions, random: () => number): T {
  const k = opts.strength;
  let v = value;
  if (opts.colours) {
    // One turn round the colour wheel for the whole thing, so its colours stay in harmony, and a little each.
    const turn = (random() - 0.5) * 140 * k;
    const sat = 1 + (random() - 0.5) * 0.5 * k;
    const light = (random() - 0.5) * 0.12 * k;
    v = mapColours(v, (c) => {
      const hsl = hexToHsl(c);
      return hsl.s < 0.04 ? hslToHex({ ...hsl, l: hsl.l + light * 0.5 }) : hslToHex({ h: hsl.h + turn + (random() - 0.5) * 16 * k, s: hsl.s * sat, l: hsl.l + light });
    });
  }
  const walk = (x: unknown, key: string): unknown => {
    if (typeof x === 'number') {
      if (opts.patterns && key === 'seed') return Math.floor(random() * 99999);
      if (opts.sizes && SIZE_KEYS.has(key) && x > 0) return x * (1 + (random() - 0.5) * 0.5 * k);
      if (opts.sizes && COUNT_KEYS.has(key) && x > 2) return Math.max(1, Math.round(x * (1 + (random() - 0.5) * 0.4 * k)));
      return x;
    }
    if (Array.isArray(x)) return x.map((y) => walk(y, key));
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([kk, y]) => [kk, walk(y, kk)]));
    return x;
  };
  return walk(v, '') as T;
}

/**
 * A variation of a design: new seeds, colours turned round the colour wheel
 * and sizes nudged, each within `strength`, the same for the same `seed`.
 * Locked layers (and what is in a locked group) stay exactly as they are,
 * and so do the stage and the layers' order, names and ids.
 */
export function randomise(project: FrameProject, opts: RandomiseOptions, seed: number): FrameProject {
  const random = seededRandom(seed * 2654435 + 0x7a11);
  const layers = eachUnlocked(project.layers, (l) => {
    const { id, name, type, visible, locked, blend, clip, mask, ...rest } = l as Layer & Record<string, unknown>;
    return { ...vary(rest, opts, random), id, name, type, visible, locked, blend, clip, mask } as unknown as Layer;
  });
  return checked({ ...project, layers });
}

/** A variation of one stack of effects (the dice in Effects): new seeds, colours and sizes. */
export function randomiseEffects(effects: Effect[], opts: RandomiseOptions, seed: number): Effect[] {
  const random = seededRandom(seed * 7919 + 0xd1ce);
  const r = parseProject({ format: PROJECT_FORMAT, schemaVersion: SCHEMA_VERSION, name: 'x', stage: {}, layers: [{ type: 'group', effects: vary(effects, opts, random) }] });
  return r.ok ? r.project.layers[0].effects : effects;
}

// ---------------------------------------------------------------- theme colours

/** How colourful a colour is (0 grey … 1 pure), for weighting. */
const chroma = (c: Hsl) => c.s * (1 - Math.abs(2 * c.l - 1));

/** The average hue of some colours, weighted by how colourful each is (null if they are all grey). */
function meanHue(cs: Hsl[]): number | null {
  let x = 0;
  let y = 0;
  for (const c of cs) {
    const w = chroma(c);
    x += Math.cos((c.h * Math.PI) / 180) * w;
    y += Math.sin((c.h * Math.PI) / 180) * w;
  }
  return Math.hypot(x, y) < 1e-6 ? null : (Math.atan2(y, x) * 180) / Math.PI;
}

const hueGap = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/**
 * The design recoloured from a theme: its colours are turned round the
 * colour wheel so their (weighted) average hue becomes the theme colour's,
 * and their colourfulness scaled to match, keeping every colour's own
 * lightness, so metal stays metal and shadows stay dark. With a second
 * colour, the design's colours are split into two families by hue (the main
 * one and the accents) and each family follows its own theme colour. Greys
 * stay grey. Locked layers are left alone. Token Maker frame layers and
 * converted frames recolour like the rest.
 */
export function recolour(project: FrameProject, primary: string, secondary: string | null = null): FrameProject {
  const unlocked = eachUnlocked(project.layers, (l) => l);
  const all = coloursIn(collectUnlocked(unlocked)).map(hexToHsl).filter((c) => c.s >= 0.06);
  if (all.length === 0) return project;
  const target = [hexToHsl(primary), secondary ? hexToHsl(secondary) : null];
  // Families: one, or two split round the two most different hues (a few rounds of 2-means on the colour wheel).
  let centres = [meanHue(all) ?? 0];
  if (target[1]) {
    const strongest = [...all].sort((a, b) => chroma(b) - chroma(a))[0].h;
    const farthest = [...all].sort((a, b) => hueGap(b.h, strongest) - hueGap(a.h, strongest))[0].h;
    centres = [strongest, farthest];
    for (let round = 0; round < 6; round++) {
      const groups = [0, 1].map((k) => all.filter((c) => (hueGap(c.h, centres[0]) <= hueGap(c.h, centres[1]) ? 0 : 1) === k));
      centres = groups.map((g, k) => meanHue(g) ?? centres[k]);
    }
    // The family with more colour in it is the design's main one, and takes the theme colour; the other the accent.
    const weight = (k: number) => all.filter((c) => (hueGap(c.h, centres[0]) <= hueGap(c.h, centres[1]) ? 0 : 1) === k).reduce((s, c) => s + chroma(c), 0);
    if (weight(1) > weight(0)) centres = [centres[1], centres[0]];
  }
  const family = (c: Hsl) => (centres.length > 1 && hueGap(c.h, centres[1]) < hueGap(c.h, centres[0]) ? 1 : 0);
  const meanS = [0, 1].map((k) => {
    const g = all.filter((c) => family(c) === k);
    return g.length ? g.reduce((s, c) => s + c.s, 0) / g.length : 1;
  });
  const layers = eachUnlocked(project.layers, (l) =>
    mapColours(l, (hex) => {
      const c = hexToHsl(hex);
      if (c.s < 0.06) return hex;
      const k = family(c);
      const t = target[k] ?? target[0]!;
      const turn = t.h - centres[k];
      return hslToHex({ h: c.h + turn, s: Math.min(1, (c.s * Math.max(0.05, t.s)) / Math.max(0.05, meanS[k])), l: c.l });
    }),
  );
  return checked({ ...project, layers });
}

/** The unlocked layers' own settings (without locked children), for collecting their colours. */
function collectUnlocked(layers: Layer[]): Layer[] {
  return layers.filter((l) => !l.locked).map((l) => (l.type === 'group' ? { ...l, children: collectUnlocked(l.children) } : l));
}
