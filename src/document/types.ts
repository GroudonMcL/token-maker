// The TokenDocument (DESIGN.md §4.1): everything about a token in one plain
// JSON object. Images are not stored here, only asset ids.

import type { FrameStyle, ShapeId } from '../render/catalog';

export const SCHEMA_VERSION = 1;

export type SizePreset = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan' | 'custom';

/**
 * Units (DESIGN.md §4.2): values marked "per square" are measured in half
 * grid squares, so 1 = half a square and 0.1 = 5 % of a square. They look
 * the same on the map whatever the creature's size.
 */
export interface TokenDocument {
  schemaVersion: number;
  name: string;
  size: { preset: SizePreset; squares: number };
  shape: ShapeId;
  art: ArtLayer;
  background: BackgroundLayer;
  foreground: OverlayLayer[];
  lighting: LightingSettings;
  effects: EffectLayer[];
  frame: FrameSettings;
  decorations: Decoration[];
  shadows: ShadowSettings;
  label: LabelSettings | null;
}

export interface ArtTransform {
  /** Multiplier on the scale that exactly covers the frame at 0°. */
  zoom: number;
  /** Art centre offset from the token centre, as fractions of the token's half-size (art scales with the token). */
  offsetX: number;
  offsetY: number;
  /** Degrees, clockwise. */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  /** "Keep the frame filled": the art always covers the frame. */
  lockFill: boolean;
}

export interface ArtLayer {
  /** e.g. "asset:abc123", or null before an image is imported. */
  assetId: string | null;
  transform: ArtTransform;
  /** Image section (DESIGN.md §6.2). None of these change the original pixels. */
  adjust: ImageAdjustments;
  removal: BackgroundRemoval;
  /** Erase/restore brush strokes on the removal mask, oldest first. */
  strokes: BrushStroke[];
}

/** Slider values as shown in the panel. 0 (and `invert: false`) means "no change". */
export interface ImageAdjustments {
  /** −100…100 */
  brightness: number;
  /** −100…100 */
  contrast: number;
  /** −100…100 */
  saturation: number;
  /** −180…180 degrees */
  hue: number;
  /** −100 (cool) … 100 (warm) */
  temperature: number;
  /** −100 (green) … 100 (magenta) */
  tint: number;
  /** −100…100 = −2…+2 stops */
  exposure: number;
  /** −100…100 */
  highlights: number;
  /** −100…100 */
  shadows: number;
  /** 0…100 */
  sharpness: number;
  /** 0…100 */
  blur: number;
  /** −100…100 */
  vibrance: number;
  /** 0…100 */
  grayscale: number;
  /** 0…100 */
  sepia: number;
  invert: boolean;
}

/** Flat-colour background removal (the extension's method), kept as a mask. */
export interface BackgroundRemoval {
  enabled: boolean;
  /** Picked with the eyedropper; null = found automatically from the image's edges. */
  color: string | null;
  /** Where the eyedropper clicked, as fractions of the image's width and height: removal also spreads from here. */
  seed: { x: number; y: number } | null;
  /** 0…100: how similar a colour must be to the background to be removed. */
  intensity: number;
  /** 0…100: how soft the cut edge is. */
  softness: number;
}

/**
 * One brush stroke, in the art image's own coordinates, so it follows the art
 * when it is moved, zoomed, rotated or flipped (and works at any resolution).
 */
export interface BrushStroke {
  id: string;
  mode: 'erase' | 'restore';
  /** Brush radius as a fraction of the image's longer side. */
  radius: number;
  /** 0 = hard edge, 1 = very soft. */
  softness: number;
  /** Flat list of (x, y, pressure) triples; x and y are fractions of the image's longer side, pressure 0…1. */
  points: number[];
}

export interface FrameSettings {
  kind: 'code';
  /** Which preset tile is selected (two presets can share a style, e.g. Arcane/Infernal). */
  presetId: string;
  style: FrameStyle;
  color: string;
  /** "Frame highlights colour" for details that don't follow `color` (Monk's beads…); null = the frame's own default. */
  highlightColor: string | null;
  /** Per square. */
  thickness: number;
  /** Gap between the image edge and the frame, per square. */
  outerSpacing: number;
  /** Gap between the frame and the art, filled with the backing, per square. */
  innerSpacing: number;
  backingColor: string;
  backingOpacity: number;
}

export interface OuterShadow {
  enabled: boolean;
  /** Follow the light direction (Phase 4/5); when false, `angle` is used. */
  followLight: boolean;
  /** Direction the shadow falls, degrees (0 = right, 90 = down). */
  angle: number;
  /** Per square. */
  distance: number;
  /** Per square. */
  blur: number;
  color: string;
  opacity: number;
}

export interface InnerShadow {
  enabled: boolean;
  /** 0–1. */
  strength: number;
  /** Blur, per square. */
  softness: number;
}

export interface ShadowSettings {
  outer: OuterShadow;
  inner: InnerShadow;
  /** Pop-out shadow: Phase 5. */
  popOut: OuterShadow;
}

// ---- Layers built in later phases. Kept minimal so the shape is settled now. ----

/** Phase 4. */
export type BackgroundLayer = { kind: 'none' };
/** Phase 4. */
export type OverlayLayer = { id: string; kind: string; [key: string]: unknown };
/** Phase 4: light direction is degrees the light comes FROM (225 = top left). */
export interface LightingSettings {
  direction: number;
}
/** Phase 6. */
export type EffectLayer = { id: string; kind: string; placement: 'behind' | 'over' | 'border'; [key: string]: unknown };
/** Phase 7. */
export type Decoration = { id: string; kind: string; [key: string]: unknown };
/** Phase 8. */
export type LabelSettings = { text: string; [key: string]: unknown };
