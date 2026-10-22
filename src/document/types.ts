// The TokenDocument (DESIGN.md §4.1): everything about a token in one plain
// JSON object. Images are not stored here, only asset ids.

import type { FrameStyle, ShapeId } from '../render/catalog';

export const SCHEMA_VERSION = 2;

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
  /** Colour and detail adjustments (Phase 3). */
  adjust: ImageAdjustments;
  /** Flat-colour background removal (Phase 3). */
  removal: BackgroundRemoval;
  /** Erase/restore brush strokes on the removal mask, in order (Phase 3). */
  strokes: MaskStroke[];
}

/**
 * Image adjustments (DESIGN.md §6.2). All 0 = unchanged. Most run -100…100;
 * hue is degrees (-180…180); sharpness, blur, grayscale and sepia run 0…100.
 */
export interface ImageAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  temperature: number;
  tint: number;
  exposure: number;
  highlights: number;
  shadows: number;
  sharpness: number;
  /** Blur radius, measured on the image itself (100 = 2 % of its longer side). */
  blur: number;
  vibrance: number;
  grayscale: number;
  sepia: number;
  invert: boolean;
}

export interface BackgroundRemoval {
  enabled: boolean;
  /** The colour to remove, or null to find it from the image's edges. */
  color: string | null;
  /** 0…100: how different a colour may be and still count as background. */
  intensity: number;
  /** 0…100: how soft the cut-out edge is. */
  softness: number;
}

/**
 * One erase or restore brush stroke on the art's mask. Stored in the art
 * image's own coordinates (0…1 across its width and height), so it moves with
 * the art and draws the same at every resolution.
 */
export interface MaskStroke {
  mode: 'erase' | 'restore';
  /** Brush diameter as a fraction of the image's longer side. */
  size: number;
  /** 0 = hard edge, 1 = very soft. */
  softness: number;
  /** Flat list of x, y, pressure (0…1) for each point. */
  points: number[];
}

export interface FrameSettings {
  kind: 'code';
  /** Which preset tile is selected (two presets can share a style, e.g. Arcane/Infernal). */
  presetId: string;
  style: FrameStyle;
  color: string;
  /** Per square. */
  thickness: number;
  /** Gap between the image edge and the frame, per square. */
  outerSpacing: number;
  /** Gap between the frame and the art, filled with the backing, per square. */
  innerSpacing: number;
  opacity: number;
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
