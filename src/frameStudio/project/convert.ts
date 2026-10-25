// Converting Token Maker frames into stacks of editable layers (Phase 4,
// DESIGN.md §4.7). Every drawn frame shares one build (TOKEN-MAKER-CONTEXT.md
// §2.2): a lit band, a pressed-in step, a texture, the step's crease, two rims
// and ornaments. A converter writes those parts as layers with the numbers
// token-maker's finishes use, so the stack draws like the original and every
// part can then be changed on its own. convert.test.ts measures how close
// each conversion is against the original, on every shape and at several
// sizes.

import { framePresetById, type FrameStyle } from '../../render/catalog';
import { mix, shade } from '../../render/color';
import { frameAccent } from '../../render/frames';
import { seededRandom } from '../../render/frameKit';
import { bandFillLayer, createProject, gearsLayer, groupLayer, growthLayer, knotworkLayer, lineLayer, newId, repeatLayer, textureLayer } from './defaults';
import { STAMPED_OUTER, STAMPED_STEP, stampedStops } from './stamped';
import { shadow } from './styles';
import { cloneAllWithNewIds } from './tree';
import type { BandFillLayer, FrameProject, GroupLayer, Layer, LegacyFrameLayer, LineLayer, RepeatLayer, TextureKind, TextureLayer } from './types';

/**
 * Token Maker's random sizes for each of a frame's ornaments, in its order
 * (seededRandom(seed), one number each, from `min` to `max` times the size),
 * as a repeat's alternating sizes: the first eight, as many as any shape gets.
 */
function tokenMakerSizes(seed: number, min: number, max: number): number[] {
  const random = seededRandom(seed);
  return Array.from({ length: 8 }, () => min + random() * (max - min));
}

/** The colours a frame is drawn in: its colour and, for frames with own-coloured details, the highlights colour. */
export interface FrameColours {
  color: string;
  /** null = the frame's default highlights colour. */
  accent: string | null;
}

/** The shared build of a finish (token-maker's drawFinish): its band colour, lighting and step. */
interface Build {
  base: string;
  light: number;
  dark: number;
  highlight: string | null;
  /** Width of the pressed-in step, as a fraction of the band; 0 for none. */
  step: number;
}

const solid = (color: string) => ({ kind: 'solid' as const, color });

function band(b: Build, name = 'Band'): BandFillLayer {
  return { ...bandFillLayer(), name, paint: { kind: 'lit', color: b.base, light: b.light, dark: b.dark, pressed: false, highlight: b.highlight } };
}

/** The pressed-in inner step: lit from the other side. */
function step(b: Build): BandFillLayer {
  return { ...bandFillLayer(), name: 'Pressed-in step', from: 1 - b.step, to: 1, paint: { kind: 'lit', color: b.base, light: b.light, dark: b.dark, pressed: true, highlight: b.highlight } };
}

/** A line round the band; `opacity` stands in for the engine's see-through colours (a line never overlaps itself). */
function line(name: string, at: number, width: number, color: string, opacity = 1, patch: Partial<LineLayer> = {}): LineLayer {
  return { ...lineLayer(), name, at, width, paint: solid(color), opacity, ...patch };
}

/** The dark line where the step meets the band. */
const crease = (b: Build) => line('Crease', 1 - b.step, 0.03, '#190500', 0.55);

/** The lit outer rim (a gradient from the top left that turns with the light) and the dark inner rim. */
function rims(): Layer[] {
  return [
    line('Outer rim (lit)', 0.02, 0.04, '#ffffff', 1, {
      paint: {
        kind: 'linear',
        angle: 45,
        followLight: true,
        stops: [
          { at: 0, color: '#ebf5ff', opacity: 0.9 },
          { at: 0.45, color: '#fff0dc', opacity: 0.15 },
          { at: 1, color: '#000000', opacity: 0 },
        ],
      },
    }),
    line('Inner rim (shadow)', 1 - 0.012, 0.024, '#0a0200', 0.6),
  ];
}

/** token-maker's `groove`: a dark cut with a lit edge just inside it. Drawn with the textures, so clipped to the band. */
function groove(at: number, base: string, width = 0.06, name = 'Groove'): GroupLayer {
  return {
    ...groupLayer([
      line('Groove cut', at, width, shade(base, -0.8), 0.85, { clip: 'band' }),
      line('Groove edge', at + width * 0.8, width * 0.4, shade(base, 0.6), 0.45, { clip: 'band' }),
    ]),
    name,
    collapsed: true,
  };
}

/**
 * The whole build in token-maker's order: band, step, textures (clipped to
 * the band), crease, rims, then ornaments.
 */
function stack(b: Build, textures: Layer[], ornaments: Layer[]): Layer[] {
  const layers: Layer[] = [band(b)];
  if (b.step > 0) layers.push(step(b));
  layers.push(...textures);
  if (b.step > 0) layers.push(crease(b));
  layers.push(...rims(), ...ornaments);
  return layers;
}

/** A repeat with none of the optional extras switched on. */
function repeat(name: string, patch: Partial<RepeatLayer>): RepeatLayer {
  return { ...repeatLayer(), name, outline: null, raised: false, ...patch };
}

/** A texture over the band, drawn with the others before the crease (clipped to the band, as token-maker clips its textures). */
function texture(kind: TextureKind, name: string, patch: Partial<TextureLayer>): TextureLayer {
  return { ...textureLayer(kind), name, where: 'everywhere', amount: 1, scale: 1, strength: 1, color2: null, clip: 'band', ...patch };
}

/** token-maker's `marble`: on the band's darker side, `amount` as the finish asks. */
const marble = (base: string, seed: number, amount: number) => texture('marble', 'Marble', { color: base, seed, amount, where: 'shaded' });

/** token-maker's `hammerTexture`, in the texture layer's terms (1 = 8 dents per band width, dents 30 % strong). */
const hammered = (name: string, base: string, density: number, darkAlpha: number, grain = 1, seed = 0x1f2e3d) =>
  texture('hammered', name, { color: base, amount: density / 8, scale: grain, strength: darkAlpha / 0.3, seed });

/** token-maker's `runic` finishes (Arcane, Infernal, Wizard): dark marbled stone, a glowing line and glowing runes. */
function runic(runeSize: number, spacing: number): Converter {
  return ({ color }) => {
    const base = mix(shade(color, -0.8), '#20222b', 0.5);
    const glow = shade(color, 0.35);
    return stack(
      { base, light: 0.45, dark: 0.7, highlight: '#8a8f9c', step: 0.3 },
      [marble(base, 0xa4c, 1)],
      [
        line('Glowing line', 0.7, 0.035, glow, 0.9, { glow: color }),
        // Seed 0 picks the runes in token-maker's order.
        repeat('Glowing runes', { element: 'rune', mode: 'spacing', spacing, snapToCorners: false, at: 0.36, size: runeSize * 2, stretch: 0.7, fill: glow, glow: color, outlineWidth: 0.05 / 0.34, seed: 0 }),
      ],
    );
  };
}

const DEFAULT_LIGHTING = { light: 0.85, dark: 0.8, highlight: null };

type Converter = (c: FrameColours) => Layer[];

/** Converters by frame style. A style without one stays a single Token Maker frame layer. */
const CONVERTERS: Partial<Record<FrameStyle, Converter>> = {
  // Polished: just the shared build.
  line: ({ color }) => stack({ ...DEFAULT_LIGHTING, base: color, light: 0.9, dark: 0.75, step: 0.35 }, [], []),

  // Paladin: polished silver, a groove, gold crosses and blue gems between them.
  holy: ({ color, accent }) => {
    const gold = accent ?? frameAccent('holy')!;
    const b: Build = { base: color, light: 0.95, dark: 0.75, highlight: '#ffffff', step: 0.35 };
    return stack(
      b,
      [groove(0.3, color, 0.05)],
      [
        repeat('Gold crosses', { element: 'cross', count: 8, snapToCorners: true, at: 0.42, size: 0.96, stretch: 0.7, fill: gold, raised: true }),
        repeat('Blue gems', { element: 'bead', count: 8, snapToCorners: true, offset: 0.5, at: 0.42, size: 0.28, fill: '#3b6fd8', raised: true }),
      ],
    );
  },

  gilded: ({ color }) =>
    stack(
      { base: color, light: 0.95, dark: 0.8, highlight: '#fff6c8', step: 0.4 },
      [marble(color, 0x9e1d, 0.6)],
      [repeat('Beads', { element: 'bead', mode: 'spacing', spacing: 0.07 * 2.6, snapToCorners: false, at: 0.6, size: 0.14, fill: shade(color, 0.15), raised: true })],
    ),

  engraved: ({ color }) =>
    stack(
      { base: color, light: 0.7, dark: 0.75, highlight: null, step: 0.4 },
      [
        marble(color, 0xe17a, 0.7),
        groove(0.3, color, 0.1),
        // Short strokes from 2 % to 20 % of the band outside the groove.
        repeat('Tick marks', { element: 'tick', count: 40, snapToCorners: true, at: 0.19, size: 0.23, stretch: 0.05 / 0.18 / 0.23, fill: shade(color, -0.75), shaded: false, opacity: 0.8, clip: 'band' }),
      ],
      [],
    ),

  arcane: runic(0.17, 0.5),
  wizard: runic(0.26, 0.7),

  double: ({ color }) =>
    stack({ ...DEFAULT_LIGHTING, base: color, step: 0 }, [groove(0.22, color, 0.08, 'Outer groove'), groove(0.78, color, 0.08, 'Inner groove')], [
      repeat('Raised diamonds', { element: 'diamond', count: 12, snapToCorners: true, at: 0.5, size: 0.4, stretch: 1.3, fill: color, raised: true }),
    ]),

  wood: ({ color }) => stack({ base: color, light: 0.55, dark: 0.75, highlight: null, step: 0.3 }, [texture('wood', 'Wood grain', { color, seed: 0x0a4 })], []),

  stone: ({ color }) => stack({ base: color, light: 0.6, dark: 0.75, highlight: null, step: 0 }, [texture('stone', 'Stone blocks', { color, seed: 0x570e })], []),

  magma: ({ color }) => {
    const base = mix(shade(color, -0.85), '#1a1414', 0.4);
    return stack(
      { base, light: 0.35, dark: 0.6, highlight: '#6a5a55', step: 0.3 },
      [hammered('Hammered rock', base, 8, 0.5), texture('cracks', 'Glowing cracks', { color, seed: 0x1a7a })],
      [],
    );
  },

  harlequin: ({ color }) => {
    const diamonds = { element: 'diamond' as const, mode: 'spacing' as const, spacing: 0.7, snapToCorners: true, at: 0.5, size: 1.1, stretch: 0.8 / 1.1, shaded: false, outline: shade(color, -0.85), outlineWidth: 0.02 / 1.1, clip: 'band' as const };
    return stack(
      { base: color, light: 0.6, dark: 0.75, highlight: null, step: 0 },
      [
        repeat('Light diamonds', { ...diamonds, fill: shade(color, 0.55), opacity: 0.35, show: [true, false] }),
        repeat('Dark diamonds', { ...diamonds, fill: shade(color, -0.75), opacity: 0.6, show: [false, true] }),
      ],
      [],
    );
  },

  starfield: ({ color, accent }) => {
    const base = mix(shade(color, -0.8), '#0b0d1e', 0.5);
    return stack(
      { base, light: 0.35, dark: 0.6, highlight: '#4a4f7a', step: 0.25 },
      [texture('scatter', 'Stars', { color: accent ?? frameAccent('starfield')!, color2: color, seed: 0x57a2 })],
      [],
    );
  },

  riveted: ({ color }) =>
    stack(
      { base: color, light: 0.75, dark: 0.8, highlight: null, step: 0.35 },
      [hammered('Hammered metal', color, 4, 0.25), texture('wear', 'Battle wear', { color, seed: 0xf16 })],
      [repeat('Rivets', { element: 'bead', count: 12, snapToCorners: true, at: 0.33, size: 0.32, fill: shade(color, 0.05), raised: true })],
    ),

  radiant: ({ color }) => {
    const rays = { element: 'triangle' as const, mode: 'spacing' as const, spacing: 0.42, snapToCorners: true, at: 0.41, stretch: 0.2, shaded: false, clip: 'band' as const };
    return stack(
      { base: color, light: 0.95, dark: 0.75, highlight: '#fffbe0', step: 0.3 },
      [
        repeat('Long rays', { ...rays, size: 1, fill: mix(color, '#fffbe0', 0.7), opacity: 0.7, show: [true, false] }),
        repeat('Short rays', { ...rays, size: 0.75, stretch: 0.2 / 0.75, fill: shade(color, -0.4), opacity: 0.45, show: [false, true] }),
      ],
      [repeat('Suns', { element: 'bead', count: 4, snapToCorners: true, at: 0.5, size: 0.6, fill: mix(color, '#fff1b0', 0.3), raised: true })],
    );
  },

  beads: ({ color, accent }) => {
    const base = shade(color, -0.25);
    return stack({ base, light: 0.5, dark: 0.75, highlight: null, step: 0 }, [texture('rope', 'Rope', { color: base, seed: 0xbead })], [
      repeat('Prayer beads', {
        element: 'bead',
        mode: 'spacing',
        spacing: 0.62,
        snapToCorners: false,
        at: 0.5,
        size: 0.54,
        fill: mix(color, '#3a2010', 0.55),
        accentEvery: 9,
        accentScale: 0.5 / 0.27,
        accentColor: accent ?? frameAccent('beads')!,
        skipAroundAccent: 1,
        raised: true,
      }),
    ]);
  },

  stitched: ({ color, accent }) => {
    const thread = accent ?? frameAccent('stitched')!;
    const row = (at: number, name: string): GroupLayer => {
      const stitch = { element: 'tick' as const, mode: 'spacing' as const, spacing: 0.24, snapToCorners: false, rotation: 70, shaded: false, clip: 'band' as const };
      return {
        ...groupLayer([
          line('Stitch groove', at, 0.05, '#000000', 0.35, { clip: 'band' }),
          repeat('Stitch shadows', { ...stitch, at: at + 0.015, size: 0.195, stretch: 0.055 / 0.18 / 0.195, fill: '#000000', opacity: 0.5 }),
          repeat('Thread', { ...stitch, at, size: 0.18, stretch: 0.04 / 0.18 / 0.18, fill: thread }),
        ]),
        name,
        collapsed: true,
      };
    };
    return stack(
      { base: color, light: 0.45, dark: 0.7, highlight: null, step: 0.25 },
      [hammered('Leather', color, 14, 0.25, 0.4, 0x5717), row(0.16, 'Outer stitches'), row(0.66, 'Inner stitches')],
      [],
    );
  },

  sorcerer: ({ color }) => stack({ base: color, light: 0.75, dark: 0.8, highlight: null, step: 0.25 }, [texture('scales', 'Scales', { color })], []),

  // Version 10: the last four frames, with the ornaments and textures made for them.

  // Stamped: its own colours round the ring (not the metal lighting), a step 45 % wide, and veins on the dark side.
  stamped: ({ color }) => [
    { ...bandFillLayer(), name: 'Band', paint: { kind: 'ring', stops: stampedStops(STAMPED_OUTER, color), followLight: true } },
    { ...bandFillLayer(), name: 'Pressed-in step', from: 0.55, to: 1, paint: { kind: 'ring', stops: stampedStops(STAMPED_STEP, color), followLight: true } },
    texture('veins', 'Veins and marbling', { color, seed: 0x5eed, where: 'shaded' }),
    line('Crease', 0.55, 0.03, '#190500', 0.55),
    ...rims(),
  ],

  fletching: ({ color, accent }) => {
    const red = mix(color, accent ?? frameAccent('fletching')!, 0.5);
    // Open chevrons from 42 % of the band out to 42 % in, 32 % long, with lines 9 % thick.
    const chevrons = { element: 'fletching' as const, mode: 'spacing' as const, spacing: 0.4, snapToCorners: false, at: 0.45, size: 0.84, stretch: 0.32 / 0.84, outlineWidth: 0.09 / 0.84, shaded: false, clip: 'band' as const };
    return stack(
      { base: color, light: 0.6, dark: 0.75, highlight: null, step: 0.25 },
      [
        repeat('Pale fletching', { ...chevrons, fill: shade(color, 0.5), opacity: 0.55, show: [true, true, false, false] }),
        repeat('Red fletching', { ...chevrons, fill: red, opacity: 0.7, show: [false, false, true, true] }),
        line('Shaft', 0.45, 0.04, shade(color, -0.7), 0.7, { clip: 'band' }),
      ],
      [],
    );
  },

  notes: ({ color, accent }) =>
    stack(
      { base: color, light: 0.7, dark: 0.8, highlight: null, step: 0.3 },
      [marble(color, 0xba7d, 0.6), groove(0.25, color, 0.04, 'Stave line 1'), groove(0.4, color, 0.04, 'Stave line 2'), groove(0.55, color, 0.04, 'Stave line 3')],
      [
        // Token Maker's notes, wandering in and out and single or paired at random, in its order.
        repeat('Notes', { element: 'bardNote', mode: 'spacing', spacing: 1.7, snapToCorners: false, at: 0.5, size: 1, fill: accent ?? frameAccent('notes')!, shaded: false, raised: true, wander: 0.625, seed: 0xba7e }),
      ],
    ),

  eyes: ({ color, accent }) => {
    const base = shade(color, -0.2);
    return stack({ base, light: 0.5, dark: 0.75, highlight: null, step: 0.25 }, [marble(base, 0xe7e, 1.4)], [
      // Each eye a little bigger or smaller (85–105 % of half the band), at random.
      repeat('Eyes', { element: 'watchEye', count: 6, snapToCorners: true, at: 0.48, size: 0.95, stretch: 1.3, fill: accent ?? frameAccent('eyes')!, raised: true, altSizes: tokenMakerSizes(0xe7e5, 0.85 / 0.95, 1.05 / 0.95), outlineWidth: 0.05 / 0.95 }),
    ]);
  },

  // Phase 8: the frames that waited for generators.

  // Druid: wood, with a vine winding round it and leaves on alternate sides.
  vines: ({ color }) => {
    const base = mix(color, '#4a3320', 0.55);
    return stack({ base, light: 0.5, dark: 0.75, highlight: null, step: 0.25 }, [texture('wood', 'Wood grain', { color: base, seed: 0x0a4 })], [
      {
        ...growthLayer('vine'),
        name: 'Vine',
        waveLength: 1.8,
        amplitude: 0.22,
        gnarl: 0,
        thickness: 0.1,
        branching: 0,
        extra: 'leaves',
        extraSpacing: 0.9,
        extraSize: 0.36 * 2.3,
        color: shade(color, -0.35),
        extraColor: color,
        effects: [RAISED(0.45)],
      },
    ]);
  },

  // Knotwork: dark marbled metal with two strands woven round it.
  braid: ({ color }) => {
    const base = shade(color, -0.55);
    return stack({ base, light: 0.4, dark: 0.7, highlight: null, step: 0 }, [
      marble(base, 0xb4a1, 0.5),
      { ...knotworkLayer(), name: 'Knotwork', waveLength: 0.9, amplitude: 0.25, width: 0.17, color: shade(color, 0.1), outline: '#000000', outlineWidth: 0.035, outlineOpacity: 0.6, shine: true, clip: 'band' },
    ], []);
  },

  // Barbarian: hide, battle-worn, with three-claw gashes.
  claws: ({ color }) =>
    stack(
      { base: color, light: 0.5, dark: 0.75, highlight: null, step: 0.3 },
      [
        hammered('Hide', color, 10, 0.25, 0.5, 0xc1a),
        texture('wear', 'Battle wear', { color, seed: 0xba4 }),
        repeat('Claw gashes', { element: 'gash', count: 6, snapToCorners: true, at: 0.5, size: 1.65, rotation: 40.1, seed: 0xc1a3, fill: '#140500', outline: shade(color, 0.5), shaded: false, clip: 'band' }),
      ],
      [],
    ),

  // Artificer: brass, its inner edge cut into gear teeth, with little gears on the band.
  clockwork: ({ color }) =>
    stack({ base: color, light: 0.9, dark: 0.8, highlight: '#fff1c0', step: 0.3 }, [marble(color, 0xc10c, 0.5)], [
      repeat('Gear teeth', { element: 'tooth', mode: 'spacing', spacing: 0.6, snapToCorners: false, at: 1, size: 0.35, stretch: 0.34 / 0.35, fill: color, raised: true }),
      {
        ...gearsLayer(),
        name: 'Gears',
        count: 6,
        at: 0.45,
        size: 0.36 * 1.3 * 2,
        teeth: 8,
        toothDepth: 1 - 1 / 1.3,
        toothShape: 'pointed',
        spokes: 0,
        hub: 0.25,
        domed: true,
        shaded: false,
        color: shade(color, 0.2),
        effects: [RAISED(0.55)],
      },
    ]),
};

/** Token Maker's raised shadow (raised(), w × 0.05 and 0.08 away, blurred w × 0.16) as a shadow effect. */
function RAISED(opacity: number) {
  return shadow({ opacity, distance: 0.094, blur: 0.11 });
}

/**
 * How each conversion differs from the original, in a sentence, where it
 * isn't the same picture to within rounding (shown in the template picker;
 * measured in convert.test.ts, listed in DESIGN.md §4.7).
 */
export const CONVERSION_NOTES: Partial<Record<FrameStyle, string>> = {
  holy: 'The crosses are Frame Studio’s own, lit from the light you choose, so they shade a little differently; at hexagon corners they may face along the next side.',
  gilded: 'The beads’ shadows are a little stronger.',
  engraved: 'The tick marks are flat bars with square ends.',
  arcane: 'The marbling falls in slightly different places.',
  wizard: 'The marbling falls in slightly different places.',
  double: 'The diamonds are lit from the light you choose, with softer shading.',
  magma: 'The bright flecks in the rock are a little stronger.',
  harlequin: 'The diamonds’ outlines are fainter on the light diamonds.',
  radiant: 'The rays are counted along a slightly different line, so there may be one or two more or fewer.',
  riveted: 'The bright flecks in the metal are a little softer.',
  beads: 'Next to the big bead at the top, one more small bead makes way on some shapes.',
  stitched: 'The stitches are flat bars with square ends.',
  vines: 'The leaves are shaded by the light you choose.',
  braid: 'The strands really weave over and under (the original lays one strand over the other all the way round).',
  claws: 'The gashes all lean the same way (the original tilts each a little differently).',
  clockwork: 'The gears turn with the band and their shadows are softer.',
  fletching: 'The fletching sits a hair further along the band.',
  eyes: 'The eyes are lit from the light you choose, and their shadows are a little softer.',
};

/** "Not quite the same: …" for a frame whose conversion differs a little, or '' when it doesn't. */
export function differenceNote(style: FrameStyle): string {
  const note = CONVERSION_NOTES[style];
  return note ? `Not quite the same: ${note[0].toLowerCase()}${note.slice(1)}` : '';
}

/** Whether a frame style can be turned into editable layers. */
export const canConvert = (style: FrameStyle) => style in CONVERTERS;

/** The frame styles that have a converter. */
export const CONVERTIBLE_STYLES = Object.keys(CONVERTERS) as FrameStyle[];

/** A frame's parts as editable layers, bottom first, or null if it has no converter yet. Every call gives fresh ids. */
export function convertFrame(style: FrameStyle, colours: FrameColours): Layer[] | null {
  const convert = CONVERTERS[style];
  return convert ? cloneAllWithNewIds(convert(colours), newId) : null;
}

/**
 * A Token Maker frame layer turned into a group of editable layers in its
 * place: the group keeps the layer's name, visibility, opacity, blend mode
 * and clip, so the picture doesn't change. Null if it can't be converted.
 */
export function convertLegacyLayer(layer: LegacyFrameLayer): GroupLayer | null {
  const children = convertFrame(layer.style, { color: layer.color, accent: layer.accent });
  if (!children) return null;
  const { id: _id, type: _t, presetId: _p, style: _s, color: _c, accent: _a, ...common } = layer;
  return { ...common, id: newId(), type: 'group', children, collapsed: false, combine: 'normal' };
}

/** The editable layers of a Token Maker frame preset in its own colours (for the template picker). */
export function convertPreset(presetId: string): Layer[] | null {
  const preset = framePresetById(presetId);
  return preset ? convertFrame(preset.style, { color: preset.color, accent: null }) : null;
}


/** A new project holding a Token Maker frame preset as editable layers, or null if it has no converter. */
export function editableProject(presetId: string): FrameProject | null {
  const layers = convertPreset(presetId);
  return layers ? createProject(layers, framePresetById(presetId)!.name) : null;
}

/** A Token Maker frame preset as one group of editable layers, to add to a project; null if it has no converter. */
export function editableGroup(presetId: string): GroupLayer | null {
  const preset = framePresetById(presetId);
  const children = convertPreset(presetId);
  return preset && children ? { ...groupLayer(children), name: preset.name } : null;
}
