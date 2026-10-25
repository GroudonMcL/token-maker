// The Frame Studio project format (DESIGN.md §4). Everything about a design
// is in this one JSON object; the renderer reads it and nothing else. It is
// kept apart from the interface and the renderer so each can change alone.
//
// Positions and sizes are measured against the frame band, so one design fits
// every token shape and thickness (DESIGN.md §4.2):
//   - "across" positions: 0 = the band's outer edge, 1 = its inner edge
//     (values a little outside 0–1 reach past the band);
//   - sizes: fractions of the band's width;
//   - "along" positions: fractions of the way round, clockwise from the top.
// Shapes and paths can instead be placed freely, in fractions of the token's
// half-size from its centre (DESIGN.md §4.4).

import type { FrameStyle, ShapeId } from '../../render/catalog';
import { ICON_GLYPHS, type IconKind } from './iconGlyphs';
import type { PictureId } from './pictures';

export const PROJECT_FORMAT = 'frame-studio-project';
export const SCHEMA_VERSION = 10;

export interface FrameProject {
  format: typeof PROJECT_FORMAT;
  /** Bump and add a migration in migrate.ts whenever the shape of this changes. */
  schemaVersion: number;
  name: string;
  /** How the design is previewed and exported. Not part of the look itself. */
  stage: StageSettings;
  /** Bottom first: later layers are drawn on top. */
  layers: Layer[];
}

export interface StageSettings {
  shape: ShapeId;
  /** Band thickness as a fraction of the token's half-size (token-maker's 0.14 on a Medium token). */
  thickness: number;
  /** Gap between the token's edge and the band, same unit. */
  outerSpacing: number;
  /** Show the sample picture and backing inside the frame. */
  showArt: boolean;
  backingColor: string;
  /** Where the light comes from, in degrees: 0 right, 90 below, 225 top left (token-maker's light). */
  light: number;
  // The lighting rig (version 9), all off by default:
  /** More lights, each coloured, lighting bevels as well as the main one (a cold rim light, a warm fill). */
  lights: ExtraLight[];
  /** The colour shaded sides take on (instead of each bevel's shaded colour), and how much. */
  ambient: string;
  ambientStrength: number;
  /** A soft glow round the brightest parts of the whole design (0–1). */
  bloom: number;
  /** Coloured light spilling onto neighbouring parts (0–1). */
  bleed: number;
}

export interface ExtraLight {
  /** Where it comes from, in degrees (as `light`). */
  angle: number;
  color: string;
  /** 0–2 */
  strength: number;
  /** Degrees above the band (10–90). */
  height: number;
}

/** token-maker's light: from the top left. */
export const DEFAULT_LIGHT = 225;

/**
 * Blend modes offered in Advanced (all work in Canvas 2D everywhere). The
 * last one, 'destination-out', isn't a colour blend: it cuts a hole through
 * the layers below (a knockout), so the editor offers it as its own switch.
 */
export const BLEND_MODES = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'lighter',
  'color',
  // Version 5:
  'hard-light',
  'color-dodge',
  'color-burn',
  'darken',
  'lighten',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'luminosity',
  'destination-out',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

interface LayerBase {
  /** Stable for the life of the layer; never reused. */
  id: string;
  name: string;
  visible: boolean;
  /** Locked layers can't be picked on the canvas or edited. */
  locked: boolean;
  /** 0–1 */
  opacity: number;
  blend: BlendMode;
  /** Only show the layer inside the band, or inside the layer below it (like a clipping mask). */
  clip: ClipMode;
  /** Surface effects applied to the layer's picture, first first (DESIGN.md §5.4). Version 5. */
  effects: Effect[];
  /** Show the layer only through another layer's shape or brightness (version 8). */
  mask: LayerMask | null;
  /** How the layer shapes its group's shared height map (version 8): not at all, raised, or carved in. */
  heightMode: HeightMode;
  /** How high it rises or how deep it is carved (0–3). */
  heightDepth: number;
  /** How far in from its edge the slope reaches (band widths). */
  heightSize: number;
}

/** A mask from any layer (version 8). */
export interface LayerMask {
  /** The id of the layer whose picture is the mask. */
  source: string;
  /** Its shape (alpha) or its brightness (luminance). */
  mode: 'alpha' | 'luminance';
  invert: boolean;
}

export const HEIGHT_MODES = ['none', 'raise', 'carve'] as const;
export type HeightMode = (typeof HEIGHT_MODES)[number];

/*
 * Effects (version 5): non-destructive filters on a layer's (or a group's)
 * picture, before it is composited. Sizes are in band widths, so they fit
 * every token size and thickness; everything lit follows stage.light.
 */
export const BEVEL_PROFILES = ['rounded', 'chisel', 'cove', 'ridge', 'stepped'] as const;
export type BevelProfile = (typeof BEVEL_PROFILES)[number];
export const SURFACES = ['smooth', 'hammered', 'grain', 'brushed', 'cracked', 'scales'] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * A 2.5D surface: a height map made from the picture's shape (how far each
 * pixel is from its edge, through a profile) plus a surface texture, turned
 * into normals and lit by the stage's light. Raised or sunk into the band.
 */
export interface BevelEffect {
  kind: 'bevel';
  on: boolean;
  direction: 'raised' | 'sunken';
  profile: BevelProfile;
  /** How far in from the edge the slope reaches (band widths). */
  size: number;
  /** How steep it looks (0–4). */
  depth: number;
  /** Smooths the height map (band widths). */
  soften: number;
  highlight: string;
  highlightOpacity: number;
  shadow: string;
  shadowOpacity: number;
  /** Shiny highlights (0 matt – 1 polished). */
  gloss: number;
  /** How high the light is, in degrees above the band (10–90). */
  lightHeight: number;
  surface: Surface;
  /** How deep the surface texture is (0–2). */
  surfaceDepth: number;
  /** How big its marks are (band widths). */
  surfaceScale: number;
  seed: number;
}

/** A soft shadow cast away from the light (or, inside, from the edge facing it). */
export interface ShadowEffect {
  kind: 'shadow';
  on: boolean;
  inner: boolean;
  color: string;
  opacity: number;
  /** Band widths. */
  distance: number;
  /** Band widths. */
  blur: number;
}

/** A soft glow round the picture's edge, outside or inside it. */
export interface GlowEffect {
  kind: 'glow';
  on: boolean;
  inner: boolean;
  color: string;
  opacity: number;
  /** Band widths. */
  size: number;
}

/** Maps how light each pixel is to a colour gradient (a gradient map): turns anything gold, bronze, bone… */
export interface RecolourEffect {
  kind: 'recolour';
  on: boolean;
  /** Dark (at 0) to light (at 1). */
  stops: GradientStop[];
  /** 0–1: how much of the new colour. */
  amount: number;
}

export interface AdjustEffect {
  kind: 'adjust';
  on: boolean;
  /** Degrees round the colour wheel. */
  hue: number;
  /** −1 grey … 1 twice as vivid. */
  saturation: number;
  /** −1 … 1 */
  brightness: number;
  /** −1 … 1 */
  contrast: number;
}

/** Age: chipped edges, edges rubbed bright, and grime in blotches. */
export interface WearEffect {
  kind: 'wear';
  on: boolean;
  /** 0–1: how much of the edge is chipped away. */
  chips: number;
  /** 0–1: how bright the edges are rubbed. */
  polish: number;
  /** 0–1: how much grime. */
  grime: number;
  grimeColor: string;
  /** How big the marks are (band widths). */
  scale: number;
  seed: number;
  /** 0–1: fine scratches across it (version 7). */
  scratches: number;
}

/** Warps the picture with smooth noise: wobbly edges, irregular stone, subtle distortion (version 7). */
export interface DistortEffect {
  kind: 'distort';
  on: boolean;
  /** How far pixels move (band widths). */
  amount: number;
  /** How big the wobbles are (band widths). */
  scale: number;
  seed: number;
}

/** Extruded sidewalls: the shape pushed back away from the light, its sides shaded (version 8). */
export interface ExtrudeEffect {
  kind: 'extrude';
  on: boolean;
  /** How deep (band widths). */
  depth: number;
  /** How dark the sides are (0–1). */
  shade: number;
}

/** Grows (positive) or shrinks (negative) the picture's shape (version 8). */
export interface OffsetEffect {
  kind: 'offset';
  on: boolean;
  /** Band widths. */
  amount: number;
}

export type Effect = BevelEffect | ShadowEffect | GlowEffect | RecolourEffect | AdjustEffect | WearEffect | DistortEffect | ExtrudeEffect | OffsetEffect;
export const EFFECT_KINDS = ['bevel', 'shadow', 'glow', 'recolour', 'adjust', 'wear', 'distort', 'extrude', 'offset'] as const satisfies readonly Effect['kind'][];
export type EffectKind = (typeof EFFECT_KINDS)[number];

export const CLIP_MODES = ['none', 'band', 'below'] as const;
export type ClipMode = (typeof CLIP_MODES)[number];

/**
 * One of token-maker's 27 frames, drawn by its own code. It is one composite
 * layer: only the settings token-maker has (colour, highlights colour) can be
 * edited. Frames with a converter (project/convert.ts) can be turned into a
 * stack of editable layers.
 */
export interface LegacyFrameLayer extends LayerBase {
  type: 'legacyFrame';
  /** token-maker's frame preset id (e.g. 'infernal'), for its name and default colour. */
  presetId: string;
  style: FrameStyle;
  color: string;
  /** "Frame highlights colour" for frames with own-coloured details; null = the frame's default. */
  accent: string | null;
}


export interface GradientStop {
  /** 0–1 */
  at: number;
  color: string;
  /** 0 (see-through) – 1 (solid). Version 4. */
  opacity: number;
}

export interface RingStop {
  /** Degrees round the token: 0 right, 90 below, 225 top left. */
  angle: number;
  color: string;
}

/** How an area or line is coloured. */
export type Paint =
  | { kind: 'solid'; color: string }
  /**
   * token-maker's metal lighting: lit from the top left, shaded bottom right.
   * `pressed` lights it the other way, like a stamped-in step. `highlight` is
   * the lit side's colour (null: a warm, pale version of `color`, as Token
   * Maker's default).
   */
  | { kind: 'lit'; color: string; light: number; dark: number; pressed: boolean; highlight: string | null }
  /**
   * Across the whole token at `angle` degrees (0 = left to right). With
   * `followLight` the angle is for a light at the top left and turns with the
   * stage's light (like Token Maker's lit outer rim).
   */
  | { kind: 'linear'; angle: number; stops: GradientStop[]; followLight: boolean }
  /** Across the band, from its outer edge (0) to its inner edge (1). */
  | { kind: 'acrossBand'; stops: GradientStop[] }
  /**
   * Colours round the ring, blended between stops at angles (like Stamped's
   * hand-sampled colours). With `followLight` the colours turn with the
   * stage's light (the angles are for a light at the top left).
   */
  | { kind: 'ring'; stops: RingStop[]; followLight: boolean }
  /**
   * A photo texture (project/pictures.ts), tiled `scale` band widths to a
   * tile and turned `angle` degrees. With `bend` its tiles follow the band
   * round the token (on band fills); `tint` recolours it keeping its light
   * and dark; `lighting` (0–1) lightens the side facing the stage's light
   * and darkens the other. Version 10.
   */
  | { kind: 'picture'; picture: PictureId; scale: number; angle: number; bend: boolean; tint: string | null; lighting: number };

/** Fills part of the band, between two "across" positions. */
export interface BandFillLayer extends LayerBase {
  type: 'bandFill';
  from: number;
  to: number;
  paint: Paint;
}

/** A line running round the band. */
export interface LineLayer extends LayerBase {
  type: 'line';
  /** Across position of its centre. */
  at: number;
  /** Fraction of the band's width. */
  width: number;
  paint: Paint;
  dash: 'solid' | 'dashed' | 'dotted';
  /** A soft glow of this colour round the line, or null. */
  glow: string | null;
  /** How far the line wanders in and out, in band widths (0 = a plain line). */
  waveAmplitude: number;
  /** How many waves all the way round. */
  waves: number;
  /** Slides the waves round, as a fraction of one wave (0–1). */
  wavePhase: number;
  /** Fit the waves to the band (version 7): one wave every this many band widths, so the number changes with the band; 0 = use `waves`. */
  waveFit: number;
  /** The shape of the waves (version 10). */
  waveShape: WaveShape;
  /** A small shadow falling away from the light, as on raised ornaments (version 10). */
  raised: boolean;
}

export const WAVE_SHAPES = ['sine', 'zigzag', 'scallop', 'square'] as const;
export type WaveShape = (typeof WAVE_SHAPES)[number];

export const DRAWN_ELEMENT_KINDS = [
  'bead',
  'circle',
  'diamond',
  'square',
  'triangle',
  'star',
  'cross',
  'rune',
  'leaf',
  'spike',
  'chevron',
  'tick',
  'gear',
  'eye',
  'note',
  'claw',
  // Version 5, faceted and lit by the light:
  'gem',
  'plate',
  'shard',
  // Version 7:
  'tooth',
  'gash',
  // Version 10: the details of Token Maker's frames…
  'fletching',
  'bardNote',
  'watchEye',
  'cog',
  'sprig',
  // …and more ornaments.
  'heart',
  'crescent',
  'flame',
  'fleur',
  'shield',
  'sun',
  'snowflake',
  'crown',
  'jewel',
  'drop',
  'shell',
  'spiral',
  'paw',
  'feather',
  'knot',
  'skull',
  'arrow',
] as const;
/** Every ornament: Frame Studio's own, then the icons from game-icons.net (version 10). */
export const ELEMENT_KINDS = [...DRAWN_ELEMENT_KINDS, ...ICON_GLYPHS.map((g) => g.id)] as readonly ElementKind[];
export type ElementKind = (typeof DRAWN_ELEMENT_KINDS)[number] | IconKind;

/** One shape repeated evenly round the band: beads, studs, runes, gems… */
export interface RepeatLayer extends LayerBase {
  type: 'repeat';
  element: ElementKind;
  /** 'count': exactly `count`; 'spacing': as many as fit with `spacing` (band widths) between centres. */
  mode: 'count' | 'spacing';
  count: number;
  spacing: number;
  /** Round the count so the shape's corners get one each (squares 4, hexagons 6). */
  snapToCorners: boolean;
  /** Across position of the centres. */
  at: number;
  /** Height as a fraction of the band's width. */
  size: number;
  /** Width relative to height. */
  stretch: number;
  /** Degrees, on top of facing along the band. */
  rotation: number;
  /** Fraction of one gap to slide every element along the band (0–1). */
  offset: number;
  fill: string;
  outline: string | null;
  /** Fraction of the element's size. */
  outlineWidth: number;
  /** Small drop shadow, like token-maker's raised ornaments. */
  raised: boolean;
  glow: string | null;
  /** Every `every`-th element is drawn at `scale` (e.g. a big bead every 9th). 0 = off. */
  accentEvery: number;
  accentScale: number;
  accentColor: string | null;
  /** Varies which rune (or note) each element is. */
  seed: number;
  /** More colours to alternate with `fill`: element i gets [fill, ...altColors][i % n]. Empty = one colour. */
  altColors: string[];
  /** Sizes to alternate, as multiples of `size` (e.g. [1, 0.6] = big, small). Empty = all the same. */
  altSizes: number[];
  /** Leave out this many elements on each side of every bigger one (like Monk's jade beads). */
  skipAroundAccent: number;
  /** Every other element moves this far inwards and the rest as far outwards (band widths), and points the other way, like Druid's leaves. 0 = off. */
  alternateSides: number;
  /** Shade each element by the light (lit side brighter); off = one flat colour. Version 4. */
  shaded: boolean;
  /** Which elements are drawn, as a repeating on/off pattern: [true, false] = every other one. Empty = all. Version 4. */
  show: boolean[];
  // Version 6 (Phase 7):
  /** The id of a path or line layer to follow instead of the band; null (or a layer that is gone) = the band. */
  follow: string | null;
  /** Along the path (turning with it) or upright on the screen. */
  orient: RepeatOrient;
  /** Size at the end of the path (or the way round), as a multiple of the start (1 = all the same). */
  scaleEnd: number;
  /** Random variation, picked by `seed`: size (0–1, a share), angle (degrees either way), and a chance of leaving one out (0–1). */
  jitterSize: number;
  jitterAngle: number;
  skipChance: number;
  /** How a cut gem (element 'gem') is cut. */
  gemCut: GemCut;
  /** The flat top as a share of the gem (brilliant, emerald). */
  gemTable: number;
  /** How high the crown rises, so how strongly the facets catch the light (0.2–3). */
  gemCrown: number;
  /** How many sides the gem has (brilliant, rose, rough). */
  gemFacets: number;
  /** A glint of light on the side facing the light (0 = none). */
  gemSparkle: number;
  /** A metal setting round each element. */
  setting: GemSetting;
  settingColor: string;
  /** The setting's own effects (a metal style), applied to the setting alone. */
  settingEffects: Effect[];
  // Version 10:
  /** The second colour of elements made of two parts (an eye's white, a cog's hub, a gash's lit edge…). null = worked out from `fill`. */
  detail: string | null;
  /** Round the number to a multiple of this (2 keeps it even, so alternating patterns meet up all the way round). */
  multipleOf: number;
  /** Each element moves in or out by a random amount (picked by `seed`), up to half this many band widths either way. */
  wander: number;
  /** Fill with a paint (a gradient, colours round the ring, a photo texture…) instead of `fill`; null = `fill`. */
  fillPaint: Paint | null;
  /** The paint fills each element on its own (the whole token's paint shrunk into each), rather than running across the token. */
  paintEach: boolean;
}

export const REPEAT_ORIENTS = ['along', 'upright'] as const;
export type RepeatOrient = (typeof REPEAT_ORIENTS)[number];
export const GEM_CUTS = ['brilliant', 'rose', 'emerald', 'cabochon', 'rough'] as const;
export type GemCut = (typeof GEM_CUTS)[number];
export const GEM_SETTINGS = ['none', 'bezel', 'claws4', 'claws6'] as const;
export type GemSetting = (typeof GEM_SETTINGS)[number];

/**
 * Where a shape or path sits. 'band' (the default) anchors it at a point
 * round the band, so it follows every token shape and thickness: `along`
 * (0–1, clockwise from the top) and `across`, sized in band widths and turned
 * with the band. 'free' places it at `x`, `y` (fractions of the half-size from
 * the centre, +y down), sized in half-sizes, ignoring the band.
 */
export interface Placement {
  place: 'band' | 'free';
  along: number;
  across: number;
  x: number;
  y: number;
  /** Height: band widths ('band') or half-sizes ('free'). */
  size: number;
  /** Width relative to height. */
  stretch: number;
  /** Degrees, clockwise. With 'band', on top of following the band (0 = upright on the band, pointing outwards). */
  rotation: number;
  /** Extra mirrored copies: a left/right pair, a top/bottom pair, or all four. */
  mirror: MirrorMode;
  /** A radial array (version 6): this many copies round the anchor (1 = off), each pointing outwards. */
  radialCount: number;
  /** How far each copy is from the anchor: band widths ('band') or half-sizes ('free'). */
  radialRadius: number;
  /** Where the first copy is, in degrees clockwise from straight out ("up"). */
  radialStart: number;
  /** Every other copy is mirrored. */
  radialMirror: boolean;
}

export const MIRROR_MODES = ['none', 'leftRight', 'topBottom', 'four'] as const;
export type MirrorMode = (typeof MIRROR_MODES)[number];

/** How a shape or path is filled and outlined. */
export interface PlacedStyle {
  /** null = no fill. */
  fill: string | null;
  /** Shade the fill by the light (lit side brighter). */
  shaded: boolean;
  outline: string | null;
  /** Fraction of the height. */
  outlineWidth: number;
  raised: boolean;
  glow: string | null;
  /** Cut into flat faces, each lit by the light (gems, plates, crystals). Version 5. */
  faceted: boolean;
  /** The flat top as a share of the shape (0 = a point, like a pyramid). */
  facetTable: number;
  /** How steep the faces are (0.2–3). */
  facetDepth: number;
  /** Fill with a paint instead of `fill` (see RepeatLayer.fillPaint); only used when `fill` isn't null. Version 10. */
  fillPaint: Paint | null;
  /** The paint fills this shape (and each mirrored copy) on its own, rather than running across the token. Version 10. */
  paintEach: boolean;
}

export const SHAPE_KINDS = ['circle', 'rectangle', 'polygon', 'star', 'ornament'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** One shape (circle, rectangle, polygon or star) placed on the band or freely. */
export interface ShapeLayer extends LayerBase, Placement, PlacedStyle {
  type: 'shape';
  shape: ShapeKind;
  /** Polygon sides or star points. */
  sides: number;
  /** Star: inner points as a fraction of the outer ones. */
  innerRatio: number;
  /** Rectangle: corner rounding, 0–1 of half the shorter side. */
  corner: number;
  /** Ornament: which of the repeat shapes it is (a heart, a fleur-de-lis…). Version 10. */
  element: ElementKind;
  /** Ornament: its second colour (see RepeatLayer.detail). Version 10. */
  detail: string | null;
}

/**
 * A point of a path, in the layer's own units: x along (right), y down,
 * where 1 is half the layer's height. `handle` makes it a smooth curve: the
 * control point leaving it, relative to it; the one arriving is mirrored.
 */
export interface PathPoint {
  x: number;
  y: number;
  handle: { x: number; y: number } | null;
  /** The control point arriving at it, relative to it, when it isn't the mirror of `handle` (version 8; left out = mirrored). */
  handleIn?: { x: number; y: number };
}

/** A drawn path: points joined by straight lines or curves, open or closed. */
export interface PathLayer extends LayerBase, Placement, PlacedStyle {
  type: 'path';
  points: PathPoint[];
  closed: boolean;
  /** Draw the path as a filled stroke this wide (a share of its height), tapering at its ends; 0 = off (version 8). */
  stroke: number;
  /** How much it narrows at the start and at the end (0 = not, 1 = to a point). */
  taperStart: number;
  taperEnd: number;
}

export const TEXTURE_KINDS = [
  'marble',
  'hammered',
  'wear',
  'wood',
  'stone',
  'scatter',
  'rope',
  'scales',
  'cracks',
  // Version 10
  'veins',
  'brushed',
  'woven',
  'chainmail',
  'rust',
  'frost',
  'bark',
  'sparkle',
  'crackle',
  'knurl',
] as const;
export type TextureKind = (typeof TEXTURE_KINDS)[number];

export const TEXTURE_PLACES = ['everywhere', 'shaded', 'lit'] as const;
export type TexturePlace = (typeof TEXTURE_PLACES)[number];

/**
 * A procedural surface drawn over part of the band: the textures Token
 * Maker's frames are made of (DESIGN.md §4.6). Every number is relative, so
 * 1 means "as Token Maker draws it"; the seed picks one of endless variations.
 */
export interface TextureLayer extends LayerBase {
  type: 'texture';
  kind: TextureKind;
  /** Across positions it covers, as for a band fill. */
  from: number;
  to: number;
  /** The colour its marks are made from (the band's colour); the stars of a scatter; the glow of cracks. */
  color: string;
  /** A second colour: the haze behind a scatter's stars. null = none. Unused by the other kinds. */
  color2: string | null;
  /** How many marks (1 = Token Maker's amount). */
  amount: number;
  /** How big the marks are (1 = Token Maker's size). */
  scale: number;
  /** How strongly they show (1 = Token Maker's strength). */
  strength: number;
  /** Everywhere, mostly on the band's shaded side, or mostly on its lit side (follows the stage's light). */
  where: TexturePlace;
  seed: number;
}

export const TEXT_FONTS = ['runes', 'grenze', 'atkinson'] as const;
export type TextFont = (typeof TEXT_FONTS)[number];

/**
 * A line of text running round the band, or along a path or line layer
 * (version 6). Letters stand on the line with their tops outwards (or, with
 * `reverse`, read the other way with their tops inwards, for the bottom of a
 * token).
 */
export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  font: TextFont;
  /** Letter height, in band widths. */
  size: number;
  /** Extra room between letters, as a share of the letter height. */
  spacing: number;
  /** Across position of the letters' middle (on the band). */
  at: number;
  /** Where the text is, round the band or along the path (0–1, clockwise from the top). */
  along: number;
  /** `along` is the middle of the text, or where it starts. */
  align: 'centre' | 'start';
  reverse: boolean;
  /** A path or line layer to follow instead of the band. */
  follow: string | null;
  fill: string;
  outline: string | null;
  /** Fraction of the letter height. */
  outlineWidth: number;
}

/** Several lines round the band at once, a quick ring builder (version 6). */
export interface ContoursLayer extends LayerBase {
  type: 'contours';
  count: number;
  /** Across position of the first (outermost) line. */
  from: number;
  /** Across distance between lines (band widths). */
  spacing: number;
  /** The first line's width (band widths). */
  width: number;
  /** How much thinner the last line is than the first (−1 … 0.95; negative = thicker). */
  taper: number;
  paint: Paint;
  /** Every other line in this colour instead (solid and metal paints). null = all the same. */
  altColor: string | null;
  dash: 'solid' | 'dashed' | 'dotted';
}

// ---------------------------------------------------------------- generators (version 7)

export const GROWTH_KINDS = ['vine', 'roots', 'thorns', 'tendrils', 'antlers'] as const;
export type GrowthKind = (typeof GROWTH_KINDS)[number];
export const GROWTH_EXTRAS = ['none', 'leaves', 'thorns', 'berries'] as const;
export type GrowthExtra = (typeof GROWTH_EXTRAS)[number];

/**
 * Organic growth along the band or a path: a stem (wavy or gnarled) with
 * branches that curl and taper, and leaves, thorns or berries, drawn as
 * filled shapes so effects work on them (DESIGN.md §5.7).
 */
export interface GrowthLayer extends LayerBase {
  type: 'growth';
  kind: GrowthKind;
  follow: string | null;
  at: number;
  /** Stems along the track (antlers: how many antlers). */
  count: number;
  /** Band widths per wave of the stem (fitted to the band); 0 = straight. */
  waveLength: number;
  /** How far the stem wanders (band widths). */
  amplitude: number;
  /** How gnarled the stem is (0–1). */
  gnarl: number;
  /** Stem thickness (band widths). */
  thickness: number;
  /** How thin the branch tips get (0 = not at all, 1 = to a point). */
  taper: number;
  /** How often branches grow (0–1). */
  branching: number;
  /** Branch length (band widths). */
  branchLength: number;
  /** Degrees from the stem. */
  branchAngle: number;
  /** How much branches curl (degrees per band width). */
  curl: number;
  /** Levels of branches on branches (1–3). */
  depth: number;
  extra: GrowthExtra;
  /** Band widths between leaves (or thorns, berries). */
  extraSpacing: number;
  /** Their size (band widths). */
  extraSize: number;
  color: string;
  extraColor: string;
  seed: number;
}

export const FRACTURE_KINDS = ['cracks', 'lightning'] as const;
export type FractureKind = (typeof FRACTURE_KINDS)[number];

/** Branching cracks across the band, or lightning bolts along it, as geometry (version 7). */
export interface FractureLayer extends LayerBase {
  type: 'fracture';
  kind: FractureKind;
  /** The part of the band they stay in (across positions). */
  from: number;
  to: number;
  count: number;
  /** How long each main crack or bolt is (band widths). */
  length: number;
  /** How much they fork (0–1). */
  branching: number;
  /** How jagged (0–1). */
  jagged: number;
  /** Width at the start (band widths). */
  width: number;
  color: string;
  seed: number;
}

export const CELL_PATTERNS = ['voronoi', 'hex', 'brick', 'grid', 'scales'] as const;
export type CellPattern = (typeof CELL_PATTERNS)[number];

/** The band divided into separate plates (flagstones, scales, honeycomb, mosaic), each its own shape (version 7). */
export interface CellsLayer extends LayerBase {
  type: 'cells';
  pattern: CellPattern;
  from: number;
  to: number;
  /** How big a cell is (band widths). */
  size: number;
  /** The gap between cells (band widths). */
  gap: number;
  /** How irregular Voronoi cells are (0–1). */
  jitter: number;
  /** Rounded corners (0–1). */
  rounding: number;
  /** Share of cells left out (missing fragments). */
  missing: number;
  /** How much each cell's colour varies (0–1). */
  vary: number;
  color: string;
  seed: number;
}

/** Interlaced bands with real over/under crossings (version 7). */
export interface KnotworkLayer extends LayerBase {
  type: 'knotwork';
  follow: string | null;
  at: number;
  /** Band widths per crossing pair (one wave), fitted to the band. */
  waveLength: number;
  /** How far the strands swing (band widths). */
  amplitude: number;
  /** Strand width (band widths). */
  width: number;
  color: string;
  outline: string | null;
  /** Outline width each side (band widths). */
  outlineWidth: number;
  outlineOpacity: number;
  /** A shine line down each strand. */
  shine: boolean;
  /** Each strand drawn as two lines (a double band). */
  double: boolean;
  /** Swaps which strand is on top at each crossing. */
  flip: boolean;
}

/** Gears round the band or along a path (version 7). */
export interface GearsLayer extends LayerBase {
  type: 'gears';
  follow: string | null;
  at: number;
  count: number;
  snapToCorners: boolean;
  /** Diameter (band widths). */
  size: number;
  teeth: number;
  /** Tooth height as a share of the radius. */
  toothDepth: number;
  toothShape: 'square' | 'pointed';
  /** Spokes (0 = a solid wheel). */
  spokes: number;
  /** The hub's size as a share of the radius. */
  hub: number;
  /** A domed boss in the middle, lit by the light. */
  domed: boolean;
  /** Every other gear this size (a multiple). */
  altSize: number;
  /** Turns every other gear by half a tooth so neighbours mesh. */
  interlock: boolean;
  /** Degrees. */
  rotation: number;
  offset: number;
  color: string;
  shaded: boolean;
}

/** A chain of interlocking links round the band or along a path (version 7). */
export interface ChainLayer extends LayerBase {
  type: 'chain';
  follow: string | null;
  at: number;
  /** One link's length (band widths). */
  linkLength: number;
  /** Width of a link as a share of its length. */
  linkWidth: number;
  /** Thickness of the metal (band widths). */
  thickness: number;
  color: string;
  shaded: boolean;
}

/** Layers kept together: hidden, locked, faded and moved as one. */
export interface GroupLayer extends LayerBase {
  type: 'group';
  /** Bottom first, like the project's own list. */
  children: Layer[];
  /** Folded up in the layer list. */
  collapsed: boolean;
  /** How its layers' shapes combine (version 8): drawn over each other, or the first with the rest added, cut out, overlapped or excluded. */
  combine: CombineMode;
}

export const COMBINE_MODES = ['normal', 'union', 'subtract', 'intersect', 'exclude'] as const;
export type CombineMode = (typeof COMBINE_MODES)[number];

/**
 * A layer from a newer version of Frame Studio, or one this version can't
 * read. It is kept exactly as it was (and saved again) but not drawn.
 */
export interface UnsupportedLayer extends LayerBase {
  type: 'unsupported';
  originalType: string;
  data: Record<string, unknown>;
  reason: string;
}

export type Layer =
  | LegacyFrameLayer
  | BandFillLayer
  | LineLayer
  | RepeatLayer
  | TextureLayer
  | ShapeLayer
  | PathLayer
  | TextLayer
  | ContoursLayer
  | GrowthLayer
  | FractureLayer
  | CellsLayer
  | KnotworkLayer
  | GearsLayer
  | ChainLayer
  | GroupLayer
  | UnsupportedLayer;
/** Layers that a repeat or text can follow (their outline is a track). */
export type TrackLayer = PathLayer | LineLayer;
/** Layers with a placement (move, scale, rotate, mirror). */
export type PlacedLayer = ShapeLayer | PathLayer;
export type LayerType = Layer['type'];
/** The types a user can add. */
export type EditableLayerType = Exclude<LayerType, 'unsupported'>;
