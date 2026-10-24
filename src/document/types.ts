// The TokenDocument (DESIGN.md §4.1): everything about a token in one plain
// JSON object. Images are not stored here, only asset ids.

import type { FrameProject } from '../frameStudio/share/frameDesign';
import type { FrameStyle, ShapeId } from '../render/catalog';

export const SCHEMA_VERSION = 9;

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
  /** Parts painted to be drawn over the border (Phase 5). */
  popOut: PopOutSettings;
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
  /**
   * Flat-colour removal only takes the background joined to the picture's
   * edge; this also takes enclosed patches of the same colour (between an
   * arm and a staff, say) (v8).
   */
  enclosed: boolean;
  /**
   * 'colour' removes a flat colour; 'ai' uses a cut-out mask made in the
   * browser by an AI model (v8). The mask belongs to the picture, not the
   * document (src/image/aiRemoval.ts), so it follows each picture in a batch.
   */
  method: 'colour' | 'ai';
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

/** A pop-out brush stroke: like a mask stroke, but it adds to or erases the pop-out mask. */
export interface PopOutStroke extends Omit<MaskStroke, 'mode'> {
  mode: 'add' | 'erase';
}

/**
 * Pop-out (DESIGN.md §6.6): the parts of the art drawn on top of the border.
 * The mask starts empty and is painted with strokes, stored in the art
 * image's own coordinates like the erase/restore strokes, so it moves,
 * zooms, rotates and flips with the art.
 */
export interface PopOutSettings {
  /** Off keeps the painted mask but draws nothing over the border. */
  enabled: boolean;
  strokes: PopOutStroke[];
}

export interface FrameSettings {
  /**
   * A frame drawn by code, a picture (PNG) frame (Phase 7), or a design made
   * in Frame Studio (v9). Switching keeps every kind's settings.
   */
  kind: 'code' | 'image' | 'design';
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
  /** The picture frame, used when `kind` is 'image' (Phase 7). */
  image: ImageFrame | null;
  /** The Frame Studio design, used when `kind` is 'design' (v9). */
  design: DesignFrame | null;
}

/**
 * A frame designed in Frame Studio and opened from its .framestudio.json
 * file (DESIGN.md §6.12). The whole design is kept in the document, so the
 * renderer, undo, autosave and presets need nothing else; it is drawn on the
 * same band as a drawn frame (thickness and spacing), on the token's shape.
 */
export interface DesignFrame {
  /** The design's id in this browser's design library (src/state/designLibrary.ts). */
  id: string;
  /** Shown in the panel. */
  name: string;
  /** The design, as Frame Studio's reader checked it. */
  project: FrameProject;
}

/** Where a picture frame comes from: a built-in one, or one the user uploaded (kept in IndexedDB). */
export type ImageFrameSource = { type: 'library'; id: string } | { type: 'upload'; id: string };

/**
 * A picture (PNG) frame (DESIGN.md §6.9). The picture fills the token's
 * square, so it scales with the token. Its hole, found when it is picked,
 * is stored here so the renderer never has to look at the picture's pixels.
 */
export interface ImageFrame {
  source: ImageFrameSource;
  /** Shown in the panel. */
  name: string;
  /** The hole: a polygon in token units (R = 1, from the centre) as a flat x, y list. */
  hole: number[];
  /** How far the picture's solid parts reach from the centre (token units), for effects on the border. */
  outer: number;
  /** The user's nudge: the hole moved (token units) and scaled around its middle. */
  nudge: { x: number; y: number; scale: number };
}

/** The outer drop shadow and the pop-out shadow share these settings. */
export interface OuterShadow {
  enabled: boolean;
  /** Follow the light direction; when false ("unlinked"), `angle` is used. */
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
  /** The shadow pop-out parts cast onto the border. */
  popOut: OuterShadow;
}

// ---- Phase 4: background, foreground overlays and lighting (DESIGN.md §6.3–6.5) ----

export interface GradientStop {
  /** 0…1 along the gradient. */
  offset: number;
  color: string;
  /** 0…1 */
  opacity: number;
}

export interface Gradient {
  type: 'linear' | 'radial';
  /** Linear: the direction it runs towards, degrees (0 = left → right, 90 = top → bottom). */
  angle: number;
  /** Two or more, sorted by offset. */
  stops: GradientStop[];
}

export type BackgroundKind = 'none' | 'color' | 'gradient' | 'image';

/** Where a background picture comes from. */
export type BackgroundImageSource =
  /** One of the built-in pictures (public/backgrounds/<id>.webp). */
  | { type: 'library'; id: string }
  /** The user's own picture, kept like the art (an "asset:…" id). */
  | { type: 'asset'; assetId: string }
  /** An enlarged copy of the token's own art. */
  | { type: 'art' };

/**
 * The layer behind the art, inside the frame. Every kind keeps its settings,
 * so switching between Colour, Gradient and Image never loses work.
 */
export interface BackgroundLayer {
  kind: BackgroundKind;
  /** 0…1, for every kind. */
  opacity: number;
  color: string;
  gradient: Gradient;
  image: BackgroundImageSource | null;
  /** 0…100: 100 blurs by 5 % of the picture's longer side. */
  blur: number;
  /** The picture's own move/zoom, independent of the art. Zoom 1 covers the frame's opening; offsets are fractions of the token's half-size. */
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

export type LightPresetId = 'torchlight' | 'moonlight' | 'holy' | 'fel' | 'firelight' | 'underdark';

/** Light direction is the degrees the light comes FROM (0 = right, 90 = below, 225 = top left). It also sets the shadows' direction. */
export interface LightingSettings {
  direction: number;
  /** Directional light on the art. Off = the art keeps its own lighting. */
  enabled: boolean;
  /** The preset last picked; cleared when a setting is changed by hand. */
  preset: LightPresetId | null;
  color: string;
  /** 0…100 */
  strength: number;
  /** 0…100: how much darker the side away from the light gets. */
  falloff: number;
  /** A thin bright edge on the side facing the light (best with a removed background). */
  /** Softness 0…100: 0 is a crisp edge, 100 fades gently into the art (Phase 7). */
  rim: { enabled: boolean; strength: number; width: number; softness: number };
  /** Light the background the same way, so it matches the art. */
  background: boolean;
}

// ---- Phase 6: styles and effects (DESIGN.md §6.8) ----

export type EffectKind =
  // Glows
  | 'innerGlow'
  | 'outerGlow'
  // Elemental
  | 'fire'
  | 'frost'
  | 'poison'
  | 'lightning'
  | 'necrotic'
  | 'radiant'
  // Condition looks
  | 'bloodied'
  | 'petrified'
  | 'ethereal'
  | 'frightened'
  | 'poisoned'
  | 'charmed'
  | 'unconscious'
  // Atmosphere
  | 'mist'
  | 'embers'
  | 'sparkles'
  | 'smoke'
  // Overlays (the old Foreground section, v8)
  | 'vignette'
  | 'gradient'
  | 'edgeShadow'
  | 'foliage'
  | 'cobwebs'
  // A picture: a built-in sprite or the user's own (v8)
  | 'picture';

/** Where a picture (a picture effect or decoration) comes from: built in, or the user's own upload kept in IndexedDB. */
export type PictureSource = { type: 'library'; id: string } | { type: 'upload'; id: string };

/** Where an effect is drawn: under the art (layer 4), over it (layer 7) or on the frame (layer 10). */
export type EffectPlacement = 'behind' | 'over' | 'border';

/**
 * One effect in the stack, drawn bottom of the list first within its
 * placement. Every kind shares these fields.
 */
export interface EffectLayer {
  id: string;
  kind: EffectKind;
  visible: boolean;
  placement: EffectPlacement;
  /** 0…100: how strong it is. */
  intensity: number;
  color: string;
  /** Per square: how far it reaches (flame height, glow width, particle size). */
  size: number;
  /** 0…100: how much of the token it covers, or how solid a glow stays before fading. */
  spread: number;
  /** "Shuffle": picks another random layout, kept so the token always looks the same. */
  seed: number;
  /** How it mixes with what's under it; 'normal' keeps each effect's own look (v8). */
  blend: BlendMode;
  /** Blur, per square (v8). */
  blur: number;
  /** Degrees: the side it sits on (edge shadow, foliage, cobwebs), 90 = bottom (v8). */
  angle: number;
  /** 0…100: how soft its edge is (vignette, edge shadow) (v8). */
  softness: number;
  /** The colours of a gradient overlay (v8). */
  gradient: Gradient;
  /** A picture effect's picture (v8). */
  image: PictureSource | null;
  /** A picture effect: scattered copies, or one copy filling the area (v8). */
  layout: 'scatter' | 'fill';
  /** A picture effect: coloured with `color` instead of its own colours (v8). */
  tint: boolean;
}

// ---- Layers built in later phases. Kept minimal so the shape is settled now. ----

// ---- Phase 7: decorations (DESIGN.md §6.9) ----

export type DecorationKind =
  | 'gem'
  | 'roundGem'
  | 'skull'
  | 'horn'
  | 'wing'
  | 'ribbon'
  | 'laurel'
  | 'star'
  | 'chain'
  | 'crown'
  | 'sword'
  | 'shield'
  | 'staff'
  | 'bow'
  | 'holySymbol'
  | 'leaf'
  | 'lute'
  | 'dagger'
  // A picture: a built-in one or the user's own (v8)
  | 'picture';

/** The eight snap points round the frame (degrees: right 0, bottom 90, left 180, top 270). */
export type SnapPoint = 'top' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left' | 'topLeft';

/**
 * One decoration (drawn by code). Snapped ones sit on the frame band facing
 * outwards; free ones sit anywhere. Mirroring adds a matching copy on the
 * other side (left ↔ right).
 */
export interface Decoration {
  id: string;
  kind: DecorationKind;
  visible: boolean;
  place: SnapPoint | 'free';
  /** Where a free decoration's anchor sits, in token units (R = 1, from the centre). */
  x: number;
  y: number;
  /** Height, per square. */
  size: number;
  /** Degrees, clockwise, on top of the way the snap point faces. */
  rotation: number;
  mirror: boolean;
  /** Flipped left to right. */
  flip: boolean;
  /** Tint. */
  color: string;
  /** 0…1 */
  opacity: number;
  /** A picture decoration's picture (v8). */
  image: PictureSource | null;
  /** A picture decoration's width ÷ height, read from the picture when it is added (v8). */
  aspect: number;
  /** A picture decoration: coloured with `color` instead of its own colours (v8). */
  tint: boolean;
}

// ---- Phase 8: the label (DESIGN.md §6.10) ----

/** A banner, plaque, pill or box behind the text, plain text with no shape (v8), or text curved round the ring. */
export type LabelShape = 'banner' | 'plaque' | 'pill' | 'box' | 'plain' | 'ring';

/** Which point of a free label sits on its position (v8). */
export type LabelAnchor = 'topLeft' | 'top' | 'topRight' | 'left' | 'center' | 'right' | 'bottomLeft' | 'bottom' | 'bottomRight';

/**
 * The token's label (layer 14). Shapes sit at the top or bottom of the frame
 * (snapped) or anywhere (free); ring text runs along the middle of the frame
 * band, centred at `angle`. Sizes are per square.
 */
export interface LabelSettings {
  shape: LabelShape;
  /** The words, or null to use the token's name. */
  text: string | null;
  place: 'top' | 'bottom' | 'free';
  /** Where a free label's anchor point sits, token units (R = 1, from the centre). */
  x: number;
  y: number;
  /** Free labels: which point of the label sits at x, y, and the turn round it (degrees, clockwise) (v8). */
  anchor: LabelAnchor;
  rotation: number;
  /** Ring text: degrees round the ring of the text's middle (0 = right, 90 = bottom, 270 = top). */
  angle: number;
  /** Ring text: most of the ring it may cover, degrees. */
  arc: number;
  /** The shape's width, per square. */
  width: number;
  /** Banner: how much it bends (-100…100; positive = ends up, like the bottom of a ring). */
  curve: number;
  /** Box: rounded or sharp corners. */
  corners: 'rounded' | 'sharp';
  /** The shape's colour and opacity (0…1). */
  fill: string;
  opacity: number;
  /** The shape's outline: width per square (0 = none) and colour. */
  outline: { width: number; color: string };
  /** A built-in font id (src/fonts/catalog.ts) or "upload:<id>" for one of the user's own. */
  font: string;
  /** Text height, per square. */
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  /** Extra space between letters, as a share of the text size (-0.1…0.5). */
  letterSpacing: number;
  align: 'left' | 'center' | 'right';
  /** Text outline: width per square (0 = none) and colour. */
  textOutline: { width: number; color: string };
  /** Text shadow: blur per square; it falls away from the light. */
  shadow: { enabled: boolean; color: string; opacity: number; blur: number };
  /** Long names shrink so they never spill off the shape (off: the shape grows instead). */
  shrinkToFit: boolean;
}
