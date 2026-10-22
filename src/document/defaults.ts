import type {
  ArtTransform,
  BackgroundLayer,
  BackgroundRemoval,
  EffectKind,
  EffectLayer,
  Gradient,
  ImageAdjustments,
  LightingSettings,
  LightPresetId,
  OuterShadow,
  OverlayKind,
  OverlayLayer,
  SizePreset,
  TokenDocument,
} from './types';
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
  lockFill: false,
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

// ---- Phase 4: background, foreground overlays and lighting ----

export const DEFAULT_GRADIENT: Gradient = {
  type: 'linear',
  angle: 90,
  stops: [
    { offset: 0, color: '#3d5a80', opacity: 1 },
    { offset: 1, color: '#1b2233', opacity: 1 },
  ],
};

export const copyGradient = (g: Gradient): Gradient => ({ ...g, stops: g.stops.map((s) => ({ ...s })) });

export const DEFAULT_BACKGROUND: BackgroundLayer = {
  kind: 'none',
  opacity: 1,
  color: '#3a4a5c',
  gradient: DEFAULT_GRADIENT,
  image: null,
  blur: 0,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

export const DEFAULT_LIGHTING: LightingSettings = {
  direction: 225,
  enabled: false,
  preset: null,
  color: '#ffe2b0',
  strength: 50,
  falloff: 40,
  rim: { enabled: false, strength: 60, width: 30 },
  background: true,
};

/** Lighting presets (DESIGN.md §6.5): they set the light, which then stays editable. */
export const LIGHT_PRESETS: { id: LightPresetId; name: string; settings: Omit<LightingSettings, 'preset' | 'enabled' | 'background'> }[] = [
  { id: 'torchlight', name: 'Torchlight', settings: { direction: 90, color: '#ffa04a', strength: 75, falloff: 60, rim: { enabled: true, strength: 70, width: 30 } } },
  { id: 'moonlight', name: 'Moonlight', settings: { direction: 270, color: '#9db8ff', strength: 60, falloff: 55, rim: { enabled: true, strength: 50, width: 25 } } },
  { id: 'holy', name: 'Holy glow', settings: { direction: 270, color: '#fff1b8', strength: 70, falloff: 25, rim: { enabled: true, strength: 80, width: 40 } } },
  { id: 'fel', name: 'Fel green', settings: { direction: 135, color: '#76ff4a', strength: 70, falloff: 55, rim: { enabled: true, strength: 75, width: 35 } } },
  { id: 'firelight', name: 'Firelight', settings: { direction: 45, color: '#ff6a22', strength: 80, falloff: 65, rim: { enabled: true, strength: 65, width: 30 } } },
  { id: 'underdark', name: 'Underdark', settings: { direction: 225, color: '#8b5cd6', strength: 65, falloff: 80, rim: { enabled: false, strength: 40, width: 25 } } },
];

/** Starting settings for each kind of foreground overlay. */
const OVERLAY_DEFAULTS: Record<OverlayKind, Partial<OverlayLayer>> = {
  gradient: { blend: 'soft-light', opacity: 0.6, gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#ffd9a0', opacity: 0 }, { offset: 1, color: '#1b1020', opacity: 1 }] } },
  vignette: { blend: 'multiply', opacity: 0.85, color: '#120c08', size: 45, softness: 70 },
  foliage: { blend: 'normal', opacity: 1, color: '#2f5a24', size: 35, angle: 90, scale: 100 },
  smoke: { blend: 'screen', opacity: 0.55, color: '#c9ccd6', size: 50, softness: 80, scale: 100 },
  mist: { blend: 'screen', opacity: 0.7, color: '#dfe6ef', size: 40, softness: 80, angle: 90 },
  cobwebs: { blend: 'screen', opacity: 0.8, color: '#e8e8ea', size: 40, angle: 225, scale: 100 },
  shadow: { blend: 'multiply', opacity: 0.8, color: '#000000', size: 45, softness: 70, angle: 90 },
};

export const OVERLAY_NAMES: Record<OverlayKind, string> = {
  gradient: 'Gradient',
  vignette: 'Vignette',
  foliage: 'Foliage',
  smoke: 'Smoke',
  mist: 'Mist',
  cobwebs: 'Cobwebs',
  shadow: 'Edge shadow',
};

export function newOverlay(kind: OverlayKind, id = Math.random().toString(36).slice(2, 10)): OverlayLayer {
  const d = OVERLAY_DEFAULTS[kind];
  return {
    id,
    kind,
    visible: true,
    opacity: 1,
    blend: 'normal',
    color: '#000000',
    size: 50,
    softness: 50,
    angle: 90,
    scale: 100,
    seed: 1,
    ...d,
    gradient: copyGradient(d.gradient ?? DEFAULT_GRADIENT),
  };
}

// ---- Phase 6: styles and effects ----

export type EffectGroup = 'Glows' | 'Elemental' | 'Conditions' | 'Atmosphere';
export const EFFECT_GROUPS: EffectGroup[] = ['Glows', 'Elemental', 'Conditions', 'Atmosphere'];

export interface EffectInfo {
  kind: EffectKind;
  name: string;
  group: EffectGroup;
  /** Starting settings (size is per square: 0.2 = 10 % of a square). */
  defaults: Pick<EffectLayer, 'placement' | 'intensity' | 'color' | 'size' | 'spread'>;
  /** Colour swatches offered for it (the first is its default). */
  swatches: string[];
}

const fx = (kind: EffectKind, name: string, group: EffectGroup, defaults: EffectInfo['defaults'], swatches: string[] = []): EffectInfo => ({
  kind,
  name,
  group,
  defaults,
  swatches: [defaults.color, ...swatches.filter((c) => c !== defaults.color)],
});

/** Every effect (DESIGN.md §6.8), in the order the picker shows them. */
export const EFFECTS: EffectInfo[] = [
  fx('outerGlow', 'Outer glow', 'Glows', { placement: 'border', intensity: 90, color: '#6fc3ff', size: 0.16, spread: 25 }, ['#ffd76a', '#ff6a3d', '#76ff4a', '#b06aff', '#ffffff']),
  fx('innerGlow', 'Inner glow', 'Glows', { placement: 'over', intensity: 80, color: '#6fc3ff', size: 0.16, spread: 15 }, ['#ffd76a', '#ff6a3d', '#76ff4a', '#b06aff', '#ffffff']),

  fx('fire', 'Fire', 'Elemental', { placement: 'border', intensity: 95, color: '#ff7a1a', size: 0.2, spread: 70 }, ['#ff3b1a', '#ffb347', '#4aa8ff', '#76ff4a', '#c05aff']),
  fx('frost', 'Frost', 'Elemental', { placement: 'border', intensity: 95, color: '#bfe8ff', size: 0.16, spread: 70 }, ['#ffffff', '#7fd0ff', '#9be7e0']),
  fx('poison', 'Poison', 'Elemental', { placement: 'border', intensity: 95, color: '#7bd23a', size: 0.16, spread: 60 }, ['#a8e23a', '#3ad27b', '#b05ad2']),
  fx('lightning', 'Lightning', 'Elemental', { placement: 'border', intensity: 95, color: '#8fd0ff', size: 0.18, spread: 50 }, ['#ffffff', '#ffe36a', '#c08aff', '#76ff4a']),
  fx('necrotic', 'Necrotic', 'Elemental', { placement: 'border', intensity: 90, color: '#5b2a86', size: 0.2, spread: 60 }, ['#2a1a3a', '#3f8a4a', '#1a1a1a']),
  fx('radiant', 'Radiant', 'Elemental', { placement: 'border', intensity: 90, color: '#ffd76a', size: 0.22, spread: 60 }, ['#fff4c4', '#ffffff', '#ffb347']),

  fx('bloodied', 'Bloodied', 'Conditions', { placement: 'over', intensity: 85, color: '#8a0b0b', size: 0.2, spread: 50 }, ['#5a0606', '#3a6a1a', '#2a2a6a']),
  fx('petrified', 'Petrified', 'Conditions', { placement: 'over', intensity: 90, color: '#8d8a84', size: 0.2, spread: 50 }, ['#a59a86', '#6c6f75', '#7a6a5a']),
  fx('ethereal', 'Ethereal', 'Conditions', { placement: 'over', intensity: 65, color: '#cfe6ff', size: 0.2, spread: 50 }, ['#ffffff', '#b8f0e0', '#e0c8ff']),
  fx('frightened', 'Frightened', 'Conditions', { placement: 'over', intensity: 80, color: '#4a4fa8', size: 0.2, spread: 50 }, ['#2a2a4a', '#5a2a6a', '#2a5a6a']),
  fx('poisoned', 'Poisoned', 'Conditions', { placement: 'over', intensity: 80, color: '#7cc22a', size: 0.12, spread: 50 }, ['#a8d22a', '#4ac27c', '#9a5ad2']),
  fx('charmed', 'Charmed', 'Conditions', { placement: 'over', intensity: 85, color: '#ff6fb5', size: 0.14, spread: 50 }, ['#ff3b6a', '#ff9ad2', '#c08aff']),
  fx('unconscious', 'Unconscious', 'Conditions', { placement: 'over', intensity: 80, color: '#1a1d2e', size: 0.14, spread: 50 }, ['#000000', '#2a1a3a']),

  fx('mist', 'Mist', 'Atmosphere', { placement: 'over', intensity: 80, color: '#dfe6ef', size: 0.3, spread: 50 }, ['#ffffff', '#c9d6c0', '#b7c4e0', '#8a7aa0']),
  fx('embers', 'Embers', 'Atmosphere', { placement: 'over', intensity: 90, color: '#ff8a2a', size: 0.12, spread: 50 }, ['#ffd24a', '#ff4a2a', '#76ff4a', '#6ac0ff']),
  fx('sparkles', 'Sparkles', 'Atmosphere', { placement: 'over', intensity: 90, color: '#fff4c4', size: 0.12, spread: 50 }, ['#ffffff', '#ffd76a', '#9fd8ff', '#ff9ad2']),
  fx('smoke', 'Smoke', 'Atmosphere', { placement: 'over', intensity: 75, color: '#9a9ca6', size: 0.3, spread: 50 }, ['#d6d8de', '#4a4c56', '#2a2a30', '#76ff4a']),
];

export const effectInfo = (kind: EffectKind): EffectInfo => EFFECTS.find((e) => e.kind === kind)!;

/** Most effects one token can stack. */
export const MAX_EFFECTS = 12;

export function newEffect(kind: EffectKind, id = Math.random().toString(36).slice(2, 10)): EffectLayer {
  return { id, kind, visible: true, ...effectInfo(kind).defaults, seed: 1 };
}

export function createDocument(name = 'Untitled token'): TokenDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    size: { preset: 'medium', squares: 1 },
    shape: 'circle',
    art: { assetId: null, transform: { ...DEFAULT_TRANSFORM }, adjust: { ...DEFAULT_ADJUST }, removal: { ...DEFAULT_REMOVAL }, strokes: [], popOut: { enabled: true, strokes: [] } },
    background: { ...DEFAULT_BACKGROUND, gradient: copyGradient(DEFAULT_BACKGROUND.gradient) },
    foreground: [],
    lighting: { ...DEFAULT_LIGHTING, rim: { ...DEFAULT_LIGHTING.rim } },
    effects: [],
    frame: {
      kind: 'code',
      presetId: 'stamped',
      style: 'stamped',
      color: '#d7671f',
      highlightColor: null,
      thickness: 0.14,
      outerSpacing: 0.1,
      innerSpacing: 0,
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
