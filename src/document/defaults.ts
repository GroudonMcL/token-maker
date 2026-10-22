import type { ArtTransform, BackgroundRemoval, ImageAdjustments, OuterShadow, SizePreset, TokenDocument } from './types';
import { SCHEMA_VERSION } from './types';

/** Creature sizes (DESIGN.md §2). Tiny is half a square. */
export const SIZE_PRESETS: { id: Exclude<SizePreset, 'custom'>; name: string; squares: number }[] = [
  { id: 'tiny', name: 'Tiny', squares: 0.5 },
  { id: 'small', name: 'Small', squares: 1 },
  { id: 'medium', name: 'Medium', squares: 1 },
  { id: 'large', name: 'Large', squares: 2 },
  { id: 'huge', name: 'Huge', squares: 3 },
  { id: 'gargantuan', name: 'Gargantuan', squares: 4 },
];

export const MIN_SQUARES = 0.5;
export const MAX_SQUARES = 10;

export const DEFAULT_TRANSFORM: ArtTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
  lockFill: true,
};

export const DEFAULT_ADJUST: ImageAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  sharpness: 0,
  blur: 0,
  vibrance: 0,
  grayscale: 0,
  sepia: 0,
  invert: false,
};

export const DEFAULT_REMOVAL: BackgroundRemoval = { enabled: false, color: null, intensity: 20, softness: 15 };

// The extension's Stamped band: 0.14 thick with 0.1 around it for the shadow.
const OUTER_SHADOW: OuterShadow = {
  enabled: true,
  followLight: true,
  angle: 45,
  distance: 0.036,
  blur: 0.1,
  color: '#000000',
  opacity: 0.8,
};

export function createDocument(name = 'Untitled token'): TokenDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    size: { preset: 'medium', squares: 1 },
    shape: 'circle',
    art: { assetId: null, transform: { ...DEFAULT_TRANSFORM }, adjust: { ...DEFAULT_ADJUST }, removal: { ...DEFAULT_REMOVAL }, strokes: [] },
    background: { kind: 'none' },
    foreground: [],
    lighting: { direction: 225 },
    effects: [],
    frame: {
      kind: 'code',
      presetId: 'stamped',
      style: 'stamped',
      color: '#d7671f',
      thickness: 0.14,
      outerSpacing: 0.1,
      innerSpacing: 0,
      opacity: 1,
      backingColor: '#1d1f27',
      backingOpacity: 1,
    },
    decorations: [],
    shadows: {
      outer: { ...OUTER_SHADOW },
      inner: { enabled: true, strength: 0.9, softness: 0.12 },
      popOut: { ...OUTER_SHADOW, distance: 0.02, blur: 0.04, opacity: 0.6 },
    },
    label: null,
  };
}
