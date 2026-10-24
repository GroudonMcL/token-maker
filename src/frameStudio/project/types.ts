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

export const PROJECT_FORMAT = 'frame-studio-project';
export const SCHEMA_VERSION = 4;

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
}

/** token-maker's light: from the top left. */
export const DEFAULT_LIGHT = 225;

/** Blend modes offered in Advanced (all work in Canvas 2D everywhere). */
export const BLEND_MODES = ['source-over', 'multiply', 'screen', 'overlay', 'soft-light', 'lighter', 'color'] as const;
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
}

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
  | { kind: 'ring'; stops: RingStop[]; followLight: boolean };

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
}

export const ELEMENT_KINDS = [
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
] as const;
export type ElementKind = (typeof ELEMENT_KINDS)[number];

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
}

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
}

export const SHAPE_KINDS = ['circle', 'rectangle', 'polygon', 'star'] as const;
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
}

/** A drawn path: points joined by straight lines or curves, open or closed. */
export interface PathLayer extends LayerBase, Placement, PlacedStyle {
  type: 'path';
  points: PathPoint[];
  closed: boolean;
}

export const TEXTURE_KINDS = ['marble', 'hammered', 'wear', 'wood', 'stone', 'scatter', 'rope', 'scales', 'cracks'] as const;
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

/** Layers kept together: hidden, locked, faded and moved as one. */
export interface GroupLayer extends LayerBase {
  type: 'group';
  /** Bottom first, like the project's own list. */
  children: Layer[];
  /** Folded up in the layer list. */
  collapsed: boolean;
}

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

export type Layer = LegacyFrameLayer | BandFillLayer | LineLayer | RepeatLayer | TextureLayer | ShapeLayer | PathLayer | GroupLayer | UnsupportedLayer;
/** Layers with a placement (move, scale, rotate, mirror). */
export type PlacedLayer = ShapeLayer | PathLayer;
export type LayerType = Layer['type'];
/** The types a user can add. */
export type EditableLayerType = Exclude<LayerType, 'unsupported'>;
