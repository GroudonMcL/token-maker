// Starting values for projects and layers. Every layer type has predictable
// defaults, so a new layer always looks sensible straight away.

import { FRAME_PRESETS, framePresetById } from '../../render/catalog';
import { frameAccent } from '../../render/frames';
import {
  PROJECT_FORMAT,
  SCHEMA_VERSION,
  DEFAULT_LIGHT,
  type BandFillLayer,
  type EditableLayerType,
  type FrameProject,
  type GroupLayer,
  type LegacyFrameLayer,
  type Layer,
  type LineLayer,
  type PathLayer,
  type PathPoint,
  type Placement,
  type PlacedStyle,
  type RepeatLayer,
  type ShapeLayer,
  type StageSettings,
  type TextureKind,
  type TextureLayer,
} from './types';

export const DEFAULT_STAGE: StageSettings = {
  shape: 'circle',
  // token-maker's default frame on a Medium token.
  thickness: 0.14,
  outerSpacing: 0.1,
  showArt: true,
  backingColor: '#1d1f27',
  light: DEFAULT_LIGHT,
};

let counter = 0;
/** A new layer id, unique within this browser session and across saved files. */
export function newId(): string {
  counter = (counter + 1) % 0x10000;
  return `L${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 0x10000).toString(36)}`;
}

const base = (name: string) => ({ id: newId(), name, visible: true, locked: false, opacity: 1, blend: 'source-over' as const, clip: 'none' as const });

export function legacyFrameLayer(presetId: string): LegacyFrameLayer {
  const preset = framePresetById(presetId) ?? FRAME_PRESETS[0];
  return { ...base(preset.name), type: 'legacyFrame', presetId: preset.id, style: preset.style, color: preset.color, accent: null };
}

export function bandFillLayer(): BandFillLayer {
  return { ...base('Band fill'), type: 'bandFill', from: 0, to: 1, paint: { kind: 'lit', color: '#c9a24a', light: 0.85, dark: 0.8, pressed: false, highlight: null } };
}

export function lineLayer(): LineLayer {
  return { ...base('Line'), type: 'line', at: 0.5, width: 0.06, paint: { kind: 'solid', color: '#2a1a0a' }, dash: 'solid', glow: null, waveAmplitude: 0, waves: 12, wavePhase: 0 };
}

export function repeatLayer(): RepeatLayer {
  return {
    ...base('Repeated shapes'),
    type: 'repeat',
    element: 'bead',
    mode: 'count',
    count: 12,
    spacing: 1,
    snapToCorners: true,
    at: 0.5,
    size: 0.3,
    stretch: 1,
    rotation: 0,
    offset: 0,
    fill: '#e0c070',
    outline: null,
    outlineWidth: 0.08,
    raised: true,
    glow: null,
    accentEvery: 0,
    accentScale: 1.6,
    accentColor: null,
    seed: 1,
    altColors: [],
    altSizes: [],
    skipAroundAccent: 0,
    alternateSides: 0,
    shaded: true,
    show: [],
  };
}

/** A texture over the whole band, as Token Maker draws it. */
export function textureLayer(kind: TextureKind = 'marble'): TextureLayer {
  const preset = TEXTURES.find((t) => t.layer.kind === kind)?.layer ?? {};
  return { ...base('Texture'), type: 'texture', kind, from: 0, to: 1, color: '#c9a24a', color2: null, amount: 1, scale: 1, strength: 1, where: 'everywhere', seed: 1, ...preset };
}

export interface TexturePreset {
  id: string;
  name: string;
  description: string;
  /** The texture's settings (a new layer gets the rest from textureLayer). */
  layer: Partial<TextureLayer> & { kind: TextureKind };
  /** A band colour that suits it, used under it in the library and when it is added with a band. */
  band: string;
}

/**
 * The texture library (Add layer → Texture…). The first preset of each kind
 * is that kind's default. Seeds and colours are Token Maker's where a frame
 * uses the texture, so they look as they do there (variations go up to 99999).
 */
export const TEXTURES: TexturePreset[] = [
  { id: 'marble', name: 'Marble', description: 'Soft marbling and flecks on the shaded side, like Stamped and Gilded.', layer: { kind: 'marble', name: 'Marble', color: '#b98a3c', where: 'shaded', seed: 0x5eed }, band: '#b98a3c' },
  { id: 'dark-marble', name: 'Heavy marble', description: 'Marbling all the way round, like Warlock and Arcane.', layer: { kind: 'marble', name: 'Heavy marble', color: '#5a4a6a', amount: 1.4, strength: 1.4, where: 'everywhere', seed: 0xe7e }, band: '#4a3a5a' },
  { id: 'hammered', name: 'Hammered metal', description: 'Dents with a bright fleck on their lit side, like Fighter.', layer: { kind: 'hammered', name: 'Hammered metal', color: '#8a8f99', amount: 0.6, seed: 0x2e3d }, band: '#8a8f99' },
  { id: 'hide', name: 'Hide', description: 'Fine pitting, like Barbarian and Rogue leather.', layer: { kind: 'hammered', name: 'Hide', color: '#6e4a2c', amount: 1.5, scale: 0.45, strength: 0.8, seed: 0x5717 }, band: '#6e4a2c' },
  { id: 'wear', name: 'Battle wear', description: 'Dents and bright scratches, like Fighter and Barbarian.', layer: { kind: 'wear', name: 'Battle wear', color: '#8a8f99', seed: 0xf16 }, band: '#8a8f99' },
  { id: 'wood', name: 'Wood grain', description: 'Wavy grain and knots, like Oak and Druid.', layer: { kind: 'wood', name: 'Wood grain', color: '#7a5230', seed: 0x0a4 }, band: '#7a5230' },
  { id: 'stone', name: 'Stone blocks', description: 'Blocks of varied tone with mortar and pitting, like Cobblestone.', layer: { kind: 'stone', name: 'Stone blocks', color: '#7d7a72', seed: 0x570e }, band: '#7d7a72' },
  { id: 'stars', name: 'Starfield', description: 'Haze and scattered stars, like Starfield.', layer: { kind: 'scatter', name: 'Stars', color: '#ffffff', color2: '#6a5acd', seed: 0x57a2 }, band: '#1a1c3a' },
  { id: 'rope', name: 'Rope', description: 'Twisted strands, like Monk’s cord.', layer: { kind: 'rope', name: 'Rope', color: '#a07a48', seed: 0xbead }, band: '#a07a48' },
  { id: 'scales', name: 'Dragon scales', description: 'Overlapping scales in staggered rows, like Sorcerer.', layer: { kind: 'scales', name: 'Scales', color: '#3f8a5a' }, band: '#3f8a5a' },
  { id: 'cracks', name: 'Magma cracks', description: 'Glowing wandering cracks, like Magma.', layer: { kind: 'cracks', name: 'Magma cracks', color: '#ff5a1a', seed: 0x1a7a }, band: '#2a1e1c' },
];

/** A texture layer from the library. */
export function textureFromPreset(preset: TexturePreset): TextureLayer {
  return { ...textureLayer(preset.layer.kind), ...preset.layer };
}

/** The band a library texture sits on in its picture, and under it when it is added with a band. */
export function textureBand(preset: TexturePreset): BandFillLayer {
  return { ...bandFillLayer(), name: `${preset.name} band`, paint: { kind: 'lit', color: preset.band, light: 0.75, dark: 0.8, pressed: false, highlight: null } };
}

/** A new shape or path sits at the top of the band, upright, one band width tall. */
export const DEFAULT_PLACEMENT: Placement = { place: 'band', along: 0, across: 0.5, x: 0, y: -0.8, size: 0.8, stretch: 1, rotation: 0, mirror: 'none' };
const DEFAULT_STYLE: PlacedStyle = { fill: '#5fa8d3', shaded: true, outline: '#1a1008', outlineWidth: 0.06, raised: true, glow: null };

export function shapeLayer(): ShapeLayer {
  return { ...base('Shape'), type: 'shape', ...DEFAULT_PLACEMENT, ...DEFAULT_STYLE, shape: 'polygon', sides: 6, innerRatio: 0.45, corner: 0 };
}

/** A new path has no points: it is drawn by clicking on the canvas. */
export function pathLayer(points: PathPoint[] = []): PathLayer {
  return { ...base('Path'), type: 'path', ...DEFAULT_PLACEMENT, ...DEFAULT_STYLE, size: 1, points, closed: points.length > 2 };
}

export function groupLayer(children: Layer[] = []): GroupLayer {
  return { ...base('Group'), type: 'group', children, collapsed: false };
}

/** A cut gem, pointing outwards: a ready-made path. */
export const GEM_POINTS: PathPoint[] = [
  { x: -0.5, y: -0.8, handle: null },
  { x: 0.5, y: -0.8, handle: null },
  { x: 0.9, y: -0.3, handle: null },
  { x: 0, y: 1, handle: null },
  { x: -0.9, y: -0.3, handle: null },
];

export const NEW_LAYER: Record<EditableLayerType, () => Layer> = {
  legacyFrame: () => legacyFrameLayer('stamped'),
  bandFill: bandFillLayer,
  line: lineLayer,
  repeat: repeatLayer,
  texture: () => textureLayer(),
  shape: shapeLayer,
  path: () => pathLayer(),
  group: () => groupLayer(),
};

/** What each layer type is called in the interface. */
export const LAYER_TYPE_NAMES: Record<Layer['type'], string> = {
  legacyFrame: 'Token Maker frame',
  bandFill: 'Band fill',
  line: 'Line',
  repeat: 'Repeated shapes',
  texture: 'Texture',
  shape: 'Shape',
  path: 'Path',
  group: 'Group',
  unsupported: 'Unsupported layer',
};

export function createProject(layers: Layer[] = [], name = 'Untitled frame'): FrameProject {
  return { format: PROJECT_FORMAT, schemaVersion: SCHEMA_VERSION, name, stage: { ...DEFAULT_STAGE }, layers };
}

/** A project holding one token-maker frame, as a starting point. */
export function projectFromFrame(presetId: string): FrameProject {
  const layer = legacyFrameLayer(presetId);
  return createProject([layer], layer.name);
}

/** The default highlights colour of a frame, if it has own-coloured details. */
export const defaultAccent = (layer: LegacyFrameLayer) => frameAccent(layer.style);

export interface LayeredTemplate {
  id: string;
  name: string;
  description: string;
  make: () => Layer[];
}

/**
 * Designs built only from editable layers. They show what the layer types
 * can do; they are new designs, not conversions of token-maker frames.
 */
export const LAYERED_TEMPLATES: LayeredTemplate[] = [
  {
    id: 'brass-beads',
    name: 'Brass & beads',
    description: 'A lit brass band, a pressed-in step, two rims and a ring of beads.',
    make: () => [
      { ...bandFillLayer(), name: 'Brass band', paint: { kind: 'lit', color: '#b88635', light: 0.9, dark: 0.8, pressed: false, highlight: null } },
      { ...bandFillLayer(), name: 'Pressed-in step', from: 0.6, to: 1, paint: { kind: 'lit', color: '#6e4a1c', light: 0.6, dark: 0.5, pressed: true, highlight: null } },
      { ...lineLayer(), name: 'Outer rim', at: 0.02, width: 0.04, paint: { kind: 'linear', angle: 45, stops: [{ at: 0, color: '#fff6e0', opacity: 1 }, { at: 0.5, color: '#b88635', opacity: 1 }, { at: 1, color: '#2a1a08', opacity: 1 }], followLight: false } },
      { ...lineLayer(), name: 'Inner rim', at: 0.99, width: 0.03, paint: { kind: 'solid', color: '#1a0e04' } },
      { ...repeatLayer(), name: 'Beads', at: 0.6, size: 0.16, count: 24, fill: '#d9b060' },
    ],
  },
  {
    id: 'glowing-runes',
    name: 'Glowing runes',
    description: 'A dark stone band with a glowing line and runes all the way round.',
    make: () => [
      { ...bandFillLayer(), name: 'Dark stone', paint: { kind: 'lit', color: '#2a2c36', light: 0.45, dark: 0.7, pressed: false, highlight: null } },
      { ...lineLayer(), name: 'Glow line', at: 0.7, width: 0.035, paint: { kind: 'solid', color: '#a8e4ff' }, glow: '#6fc3ff' },
      {
        ...repeatLayer(),
        name: 'Runes',
        element: 'rune',
        mode: 'spacing',
        spacing: 0.55,
        snapToCorners: false,
        at: 0.36,
        size: 0.34,
        stretch: 0.7,
        fill: '#a8e4ff',
        raised: false,
        glow: '#6fc3ff',
      },
      { ...lineLayer(), name: 'Outer rim', at: 0.02, width: 0.04, paint: { kind: 'solid', color: '#6a6f7c' } },
    ],
  },
  {
    id: 'jewelled',
    name: 'Jewelled',
    description: 'Silver with a vine, alternating diamonds and a pair of drawn gems, grouped.',
    make: () => [
      { ...bandFillLayer(), name: 'Silver band', paint: { kind: 'lit', color: '#9aa3ad', light: 0.9, dark: 0.75, pressed: false, highlight: null } },
      { ...lineLayer(), name: 'Vine', at: 0.5, width: 0.05, paint: { kind: 'solid', color: '#2f5d36' }, waveAmplitude: 0.18, waves: 16 },
      { ...lineLayer(), name: 'Outer rim', at: 0.02, width: 0.04, paint: { kind: 'solid', color: '#e8ecf0' } },
      { ...lineLayer(), name: 'Inner rim', at: 0.98, width: 0.04, paint: { kind: 'solid', color: '#2a2e36' } },
      {
        ...groupLayer([
          { ...repeatLayer(), name: 'Diamonds', element: 'diamond', count: 24, size: 0.32, stretch: 0.7, fill: '#d94a4a', altColors: ['#3a7bd5'], altSizes: [1, 0.7] },
          {
            ...pathLayer(GEM_POINTS),
            name: 'Gems',
            along: 0.25,
            size: 1.2,
            fill: '#3fbf7f',
            mirror: 'leftRight',
          },
        ]),
        name: 'Jewels',
      },
    ],
  },
  {
    id: 'battle-steel',
    name: 'Battle-worn steel',
    description: 'Hammered steel with dents and scratches, a pressed-in step and a ring of rivets.',
    make: () => [
      { ...bandFillLayer(), name: 'Steel band', paint: { kind: 'lit', color: '#8a8f99', light: 0.75, dark: 0.8, pressed: false, highlight: null } },
      { ...bandFillLayer(), name: 'Pressed-in step', from: 0.65, to: 1, paint: { kind: 'lit', color: '#8a8f99', light: 0.75, dark: 0.8, pressed: true, highlight: null } },
      { ...textureLayer('hammered'), name: 'Hammered', color: '#8a8f99', amount: 0.6, seed: 0x2e3d },
      { ...textureLayer('wear'), name: 'Battle wear', color: '#8a8f99' },
      { ...lineLayer(), name: 'Outer rim', at: 0.02, width: 0.04, paint: { kind: 'solid', color: '#e8ecf0' } },
      { ...lineLayer(), name: 'Inner rim', at: 0.99, width: 0.03, paint: { kind: 'solid', color: '#14161a' } },
      { ...repeatLayer(), name: 'Rivets', at: 0.33, size: 0.3, fill: '#9aa0aa' },
    ],
  },
  {
    id: 'night-sky',
    name: 'Night sky',
    description: 'Colours round the ring from dusk to midnight, with stars, haze and a glowing line.',
    make: () => [
      {
        ...bandFillLayer(),
        name: 'Sky',
        paint: {
          kind: 'ring',
          stops: [
            { angle: 0, color: '#1a1a4a' },
            { angle: 90, color: '#0b0d1e' },
            { angle: 180, color: '#3a2a6a' },
            { angle: 225, color: '#6a4a9a' },
            { angle: 270, color: '#3a2a6a' },
          ],
          followLight: true,
        },
      },
      { ...textureLayer('scatter'), name: 'Stars', color: '#ffffff', color2: '#6a5acd', amount: 1.3 },
      { ...lineLayer(), name: 'Glow line', at: 0.75, width: 0.03, paint: { kind: 'solid', color: '#cfc4ff' }, glow: '#8a7aff' },
      { ...lineLayer(), name: 'Outer rim', at: 0.02, width: 0.04, paint: { kind: 'solid', color: '#b8b0e0' } },
    ],
  },
]
