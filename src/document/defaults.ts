import type {
  ArtTransform,
  Decoration,
  DecorationKind,
  SnapPoint,
  BackgroundLayer,
  BackgroundRemoval,
  LabelSettings,
  LabelShape,
  EffectKind,
  EffectLayer,
  Gradient,
  ImageAdjustments,
  LightingSettings,
  LightPresetId,
  OuterShadow,
  PictureSource,
  SizePreset,
  TokenDocument,
} from './types';
import { SCHEMA_VERSION } from './types';
import { DEFAULT_FONT } from '../fonts/catalog';
import { effectPicture } from '../render/pictureLibrary';

/** Creature sizes (DESIGN.md §2). Tiny covers half a square and Small 0.8 of one (owner request, v8). */
export const SIZE_PRESETS: { id: Exclude<SizePreset, 'custom'>; name: string; squares: number }[] = [
  { id: 'tiny', name: 'Tiny', squares: 0.5 },
  { id: 'small', name: 'Small', squares: 0.8 },
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

export const DEFAULT_REMOVAL: BackgroundRemoval = { enabled: false, color: null, intensity: 20, softness: 15, enclosed: true, method: 'colour' };

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

// ---- Phase 4: background and lighting ----

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
  rim: { enabled: false, strength: 60, width: 30, softness: 35 },
  background: true,
};

/** Lighting presets (DESIGN.md §6.5): they set the light, which then stays editable. */
export const LIGHT_PRESETS: { id: LightPresetId; name: string; settings: Omit<LightingSettings, 'preset' | 'enabled' | 'background'> }[] = [
  { id: 'torchlight', name: 'Torchlight', settings: { direction: 90, color: '#ffa04a', strength: 75, falloff: 60, rim: { enabled: true, strength: 70, width: 30, softness: 40 } } },
  { id: 'moonlight', name: 'Moonlight', settings: { direction: 270, color: '#9db8ff', strength: 60, falloff: 55, rim: { enabled: true, strength: 50, width: 25, softness: 50 } } },
  { id: 'holy', name: 'Holy glow', settings: { direction: 270, color: '#fff1b8', strength: 70, falloff: 25, rim: { enabled: true, strength: 80, width: 40, softness: 60 } } },
  { id: 'fel', name: 'Fel green', settings: { direction: 135, color: '#76ff4a', strength: 70, falloff: 55, rim: { enabled: true, strength: 75, width: 35, softness: 35 } } },
  { id: 'firelight', name: 'Firelight', settings: { direction: 45, color: '#ff6a22', strength: 80, falloff: 65, rim: { enabled: true, strength: 65, width: 30, softness: 30 } } },
  { id: 'underdark', name: 'Underdark', settings: { direction: 225, color: '#8b5cd6', strength: 65, falloff: 80, rim: { enabled: false, strength: 40, width: 25, softness: 35 } } },
];

// ---- Phase 6: styles and effects ----

export type EffectGroup = 'Glows' | 'Elemental' | 'Conditions' | 'Atmosphere' | 'Overlays' | 'Pictures';
export const EFFECT_GROUPS: EffectGroup[] = ['Glows', 'Elemental', 'Conditions', 'Atmosphere', 'Overlays', 'Pictures'];

/** Settings an effect's card can show besides Placement, Intensity, Blur and Blend mode. */
export type EffectControl = 'color' | 'size' | 'spread' | 'angle' | 'softness' | 'gradient' | 'seed' | 'picture';

export interface EffectInfo {
  kind: EffectKind;
  name: string;
  group: EffectGroup;
  /** Starting settings (size is per square: 0.2 = 10 % of a square). */
  defaults: Pick<EffectLayer, 'placement' | 'intensity' | 'color' | 'size' | 'spread'> & Partial<Pick<EffectLayer, 'blend' | 'angle' | 'softness' | 'gradient'>>;
  /** Colour swatches offered for it (the first is its default). */
  swatches: string[];
  /** The settings its card shows, and what some of them are called for it. */
  controls: EffectControl[];
  labels?: Partial<Record<EffectControl, string>>;
}

const DRAWN: EffectControl[] = ['color', 'size', 'spread', 'seed'];

const fx = (
  kind: EffectKind,
  name: string,
  group: EffectGroup,
  defaults: EffectInfo['defaults'],
  swatches: string[] = [],
  controls: EffectControl[] = DRAWN,
  labels?: EffectInfo['labels'],
): EffectInfo => ({
  kind,
  name,
  group,
  defaults,
  swatches: [defaults.color, ...swatches.filter((c) => c !== defaults.color)],
  controls,
  labels,
});

/** Overlays are drawn at their natural scale at this Size (the old overlay Scale of 100 %). */
export const OVERLAY_BASE_SIZE = 0.3;

/** Every effect (DESIGN.md §6.8), in the order the picker shows them. Overlays were the Foreground section until v8. */
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

  fx('vignette', 'Vignette', 'Overlays', { placement: 'over', intensity: 85, color: '#120c08', size: OVERLAY_BASE_SIZE, spread: 45, softness: 70, blend: 'multiply' }, ['#000000', '#1b2233', '#3a0d0d', '#ffffff'], ['color', 'spread', 'softness'], { spread: 'Size' }),
  fx(
    'gradient',
    'Gradient',
    'Overlays',
    { placement: 'over', intensity: 60, color: '#1b1020', size: OVERLAY_BASE_SIZE, spread: 50, blend: 'soft-light', gradient: { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#ffd9a0', opacity: 0 }, { offset: 1, color: '#1b1020', opacity: 1 }] } },
    [],
    ['gradient'],
  ),
  fx('edgeShadow', 'Edge shadow', 'Overlays', { placement: 'over', intensity: 80, color: '#000000', size: OVERLAY_BASE_SIZE, spread: 45, softness: 70, angle: 90, blend: 'multiply' }, ['#1b1020', '#0b1a2a', '#2a1a0b'], ['color', 'angle', 'spread', 'softness'], { spread: 'Reach', angle: 'Side' }),
  fx('foliage', 'Foliage', 'Overlays', { placement: 'over', intensity: 100, color: '#2f5a24', size: OVERLAY_BASE_SIZE, spread: 35, angle: 90 }, ['#4d7a2a', '#7a8a2a', '#8a4a1a', '#3a3a2a'], ['color', 'angle', 'spread', 'size', 'seed'], { spread: 'Reach', size: 'Leaf size', angle: 'Grows from' }),
  fx('cobwebs', 'Cobwebs', 'Overlays', { placement: 'over', intensity: 80, color: '#e8e8ea', size: OVERLAY_BASE_SIZE, spread: 40, angle: 225, blend: 'screen' }, ['#c9ccd6', '#9a9aa6'], ['color', 'angle', 'spread', 'size', 'seed'], { spread: 'Size', size: 'Web size', angle: 'Corner' }),

  // Picture effects use the settings of the picture picked (src/render/pictureLibrary.ts).
  fx('picture', 'Picture', 'Pictures', { placement: 'over', intensity: 90, color: '#ffffff', size: 0.3, spread: 40 }, ['#ffd76a', '#ff6a3d', '#6fc3ff', '#76ff4a', '#b06aff', '#8a0b0b'], ['picture', 'color', 'size', 'spread', 'seed'], { size: 'Picture size', spread: 'Amount' }),
];

export const effectInfo = (kind: EffectKind): EffectInfo => EFFECTS.find((e) => e.kind === kind)!;

/** Most effects one token can stack. */
export const MAX_EFFECTS = 20;

export function newEffect(kind: EffectKind, id = Math.random().toString(36).slice(2, 10)): EffectLayer {
  const d = effectInfo(kind).defaults;
  return {
    id,
    kind,
    visible: true,
    blend: 'normal',
    blur: 0,
    angle: 90,
    softness: 50,
    image: null,
    layout: 'scatter',
    tint: true,
    seed: 1,
    ...d,
    gradient: copyGradient(d.gradient ?? DEFAULT_GRADIENT),
  };
}

/** A picture effect: a built-in sprite (with its own starting settings) or one of the user's own pictures. */
export function newPictureEffect(image: PictureSource, id?: string): EffectLayer {
  const e = newEffect('picture', id);
  const lib = image.type === 'library' ? effectPicture(image.id) : undefined;
  // The user's own picture keeps its colours and fills the opening until they choose otherwise.
  if (!lib) return { ...e, image, tint: false, layout: 'fill', spread: 100, intensity: 100 };
  return { ...e, image, ...lib.defaults };
}

// ---- Phase 7: decorations ----

export type DecorationGroup = 'Treasure' | 'Creatures' | 'Trims' | 'Class icons' | 'Pictures';
export const DECORATION_GROUPS: DecorationGroup[] = ['Treasure', 'Creatures', 'Trims', 'Class icons', 'Pictures'];

export interface DecorationInfo {
  kind: DecorationKind;
  name: string;
  group: DecorationGroup;
  /** Width ÷ height of its picture. */
  aspect: number;
  /** The point of the picture (0…1 across and down) that sits on the snap point or the free position. */
  anchor: { x: number; y: number };
  /** Starting settings (size is per square, the picture's height: 0.4 = 20 % of a square). */
  defaults: { place: SnapPoint; size: number; color: string; mirror: boolean; rotation?: number };
  swatches: string[];
}

const METAL = ['#e0b23a', '#c9d2de', '#b5813a', '#7a7f8a', '#1c1c1c'];
const deco = (
  kind: DecorationKind,
  name: string,
  group: DecorationGroup,
  aspect: number,
  anchor: [number, number],
  defaults: DecorationInfo['defaults'],
  swatches: string[] = METAL,
): DecorationInfo => ({
  kind,
  name,
  group,
  aspect,
  anchor: { x: anchor[0], y: anchor[1] },
  defaults,
  swatches: [defaults.color, ...swatches.filter((c) => c !== defaults.color)],
});

const GEMS = ['#c0263a', '#2f7fd8', '#2fae5a', '#8a3fd0', '#f0c030', '#e8f4ff', '#1c1c1c'];

/**
 * Every decoration (DESIGN.md §6.9), drawn by code (src/render/decorationPainters.ts).
 * Pictures are drawn upright as they sit at the top of the token, facing outwards;
 * at other snap points they turn to keep facing outwards.
 */
export const DECORATIONS: DecorationInfo[] = [
  deco('gem', 'Gem', 'Treasure', 0.8, [0.5, 0.5], { place: 'top', size: 0.34, color: '#c0263a', mirror: false }, GEMS),
  deco('roundGem', 'Round gem', 'Treasure', 1, [0.5, 0.5], { place: 'bottom', size: 0.3, color: '#2f7fd8', mirror: false }, GEMS),
  deco('crown', 'Crown', 'Treasure', 1.3, [0.5, 0.64], { place: 'top', size: 0.5, color: '#e0b23a', mirror: false }),
  deco('star', 'Star', 'Treasure', 1, [0.5, 0.5], { place: 'topRight', size: 0.3, color: '#ffd75a', mirror: true }, ['#ffd75a', '#ffffff', '#6fc3ff', '#c0263a', '#b06aff']),
  deco('skull', 'Skull', 'Creatures', 0.85, [0.5, 0.5], { place: 'bottom', size: 0.42, color: '#e9e1cc', mirror: false }, ['#e9e1cc', '#c9c2b0', '#3a3a3a', '#6fc3ff', '#76ff4a']),
  deco('horn', 'Horn', 'Creatures', 0.6, [0.62, 0.95], { place: 'topRight', size: 0.62, color: '#d8c9a8', mirror: true }, ['#d8c9a8', '#4a3a2e', '#1c1c1c', '#b8322a', '#c9d2de']),
  deco('wing', 'Wing', 'Creatures', 0.8, [0.78, 0.92], { place: 'right', size: 0.85, color: '#f2f0ea', mirror: true }, ['#f2f0ea', '#2a2a30', '#6a2a2a', '#5b2d7a', '#e0b23a']),
  deco('ribbon', 'Ribbon', 'Trims', 1.6, [0.5, 0.45], { place: 'bottom', size: 0.5, color: '#b8322a', mirror: false }, ['#b8322a', '#2f5fa8', '#2f7a3a', '#5b2d7a', '#e0b23a', '#1c1c1c']),
  deco('laurel', 'Laurel', 'Trims', 2, [0.5, 0.55], { place: 'bottomRight', size: 0.62, color: '#c9a24a', mirror: true }, ['#c9a24a', '#5e9a3a', '#c9d2de', '#1c1c1c']),
  deco('chain', 'Chain', 'Trims', 3, [0.5, 0.5], { place: 'bottom', size: 0.24, color: '#9aa0a8', mirror: false }),
  deco('leaf', 'Leaf', 'Trims', 0.6, [0.5, 0.92], { place: 'topLeft', size: 0.38, color: '#5e9a3a', mirror: false }, ['#5e9a3a', '#c9a24a', '#b8322a', '#e07a2a']),
  deco('sword', 'Sword', 'Class icons', 0.3, [0.5, 0.5], { place: 'bottomRight', size: 0.8, color: '#c9d2de', mirror: false, rotation: -90 }),
  deco('dagger', 'Dagger', 'Class icons', 0.3, [0.5, 0.5], { place: 'bottomRight', size: 0.56, color: '#c9d2de', mirror: false, rotation: -90 }),
  deco('shield', 'Shield', 'Class icons', 0.85, [0.5, 0.62], { place: 'bottom', size: 0.46, color: '#3f6fd8', mirror: false }, ['#3f6fd8', '#b8322a', '#2f7a3a', '#5b2d7a', '#1c1c1c', '#e0b23a']),
  deco('staff', 'Staff', 'Class icons', 0.3, [0.5, 0.5], { place: 'bottomRight', size: 0.8, color: '#6fc3ff', mirror: false, rotation: -90 }, ['#6fc3ff', '#b06aff', '#76ff4a', '#ff6a3d', '#ffd75a']),
  deco('bow', 'Bow', 'Class icons', 0.5, [0.5, 0.5], { place: 'bottomRight', size: 0.7, color: '#8a5a32', mirror: false, rotation: -90 }, ['#8a5a32', '#4a3a2e', '#c9a24a', '#2f5a24']),
  deco('holySymbol', 'Holy symbol', 'Class icons', 1, [0.5, 0.5], { place: 'top', size: 0.42, color: '#f0c850', mirror: false }, ['#f0c850', '#ffffff', '#c9d2de', '#ff9a3a']),
  deco('lute', 'Lute', 'Class icons', 0.5, [0.5, 0.5], { place: 'bottomLeft', size: 0.6, color: '#b5813a', mirror: false }, ['#b5813a', '#8a5a32', '#8e3b8f', '#3f6fd8']),
  // A picture (src/render/pictureLibrary.ts): its width comes from the picture itself.
  deco('picture', 'Picture', 'Pictures', 1, [0.5, 0.5], { place: 'topRight', size: 0.4, color: '#ffffff', mirror: false }, ['#ffffff', ...METAL]),
];

export const decorationInfo = (kind: DecorationKind): DecorationInfo => DECORATIONS.find((d) => d.kind === kind)!;

/** Most decorations one token can have. */
export const MAX_DECORATIONS = 16;

export function newDecoration(kind: DecorationKind, id = Math.random().toString(36).slice(2, 10)): Decoration {
  const d = decorationInfo(kind).defaults;
  return { id, kind, visible: true, place: d.place, x: 0, y: -0.8, size: d.size, rotation: d.rotation ?? 0, mirror: d.mirror, flip: false, color: d.color, opacity: 1, image: null, tint: true, aspect: decorationInfo(kind).aspect };
}

/** A picture decoration: a built-in icon (coloured) or one of the user's own pictures (its own colours). */
export function newPictureDecoration(image: PictureSource, aspect: number, color?: string, id?: string): Decoration {
  const d = newDecoration('picture', id);
  return { ...d, image, aspect: aspect > 0 && Number.isFinite(aspect) ? aspect : 1, tint: image.type === 'library', color: color ?? d.color };
}

// ---- Phase 8: the label (DESIGN.md §6.10) ----

export const LABEL_SHAPES: { id: LabelShape; name: string }[] = [
  { id: 'banner', name: 'Banner' },
  { id: 'plaque', name: 'Plaque' },
  { id: 'pill', name: 'Pill' },
  { id: 'box', name: 'Box' },
  { id: 'plain', name: 'Plain text' },
  { id: 'ring', name: 'Ring text' },
];

/** A new label: a parchment banner across the bottom of the frame, in Cinzel, showing the token's name. */
export function newLabel(): LabelSettings {
  return {
    shape: 'banner',
    text: null,
    place: 'bottom',
    x: 0,
    y: 0.75,
    anchor: 'center',
    rotation: 0,
    angle: 90,
    arc: 160,
    width: 1.3,
    curve: 25,
    corners: 'rounded',
    fill: '#e9d9b4',
    opacity: 1,
    outline: { width: 0.02, color: '#5a3d1e' },
    font: DEFAULT_FONT,
    size: 0.2,
    color: '#3a2412',
    bold: true,
    italic: false,
    letterSpacing: 0.04,
    align: 'center',
    textOutline: { width: 0, color: '#000000' },
    shadow: { enabled: false, color: '#000000', opacity: 0.6, blur: 0.03 },
    shrinkToFit: true,
  };
}

/** Ring text reads best light on a dark frame, with an outline and a shadow. */
export const RING_TEXT_STYLE: Partial<LabelSettings> = {
  color: '#fff4dc',
  textOutline: { width: 0.02, color: '#20140a' },
  shadow: { enabled: true, color: '#000000', opacity: 0.7, blur: 0.03 },
};

export function createDocument(name = 'Untitled token'): TokenDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    name,
    size: { preset: 'medium', squares: 1 },
    shape: 'circle',
    art: { assetId: null, transform: { ...DEFAULT_TRANSFORM }, adjust: { ...DEFAULT_ADJUST }, removal: { ...DEFAULT_REMOVAL }, strokes: [], popOut: { enabled: true, strokes: [] } },
    background: { ...DEFAULT_BACKGROUND, gradient: copyGradient(DEFAULT_BACKGROUND.gradient) },
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
      image: null,
      design: null,
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
