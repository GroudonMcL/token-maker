// Loading saved documents safely (DESIGN.md §4.1): older versions are
// upgraded step by step, then everything is checked and filled in from the
// defaults, so a damaged or partial file can never crash the editor.

import { readFrameDesign } from '../frameStudio/share/frameDesign';
import { FRAME_STYLES, SHAPES } from '../render/catalog';
import {
  copyGradient,
  createDocument,
  DECORATIONS,
  DEFAULT_ADJUST,
  EFFECTS,
  LIGHT_PRESETS,
  MAX_DECORATIONS,
  MAX_EFFECTS,
  MAX_SQUARES,
  MIN_SQUARES,
  newDecoration,
  newEffect,
  newLabel,
  newPictureDecoration,
  OVERLAY_BASE_SIZE,
  SIZE_PRESETS,
} from './defaults';
import {
  SCHEMA_VERSION,
  type BackgroundImageSource,
  type BackgroundLayer,
  type BlendMode,
  type DesignFrame,
  type Decoration,
  type DecorationKind,
  type ImageFrame,
  type SnapPoint,
  type EffectKind,
  type EffectLayer,
  type EffectPlacement,
  type Gradient,
  type ImageAdjustments,
  type LabelSettings,
  type LightingSettings,
  type LightPresetId,
  type MaskStroke,
  type PictureSource,
  type PopOutStroke,
  type LabelAnchor,
  type TokenDocument,
} from './types';

type Json = Record<string, unknown>;

/**
 * Migrations: `MIGRATIONS[n]` turns a version-n document into version n+1.
 * When the document shape changes: bump SCHEMA_VERSION in types.ts and add
 * the step here, with a test in migrate.test.ts.
 */
export const MIGRATIONS: Record<number, (doc: Json) => Json> = {
  // v1 → v2 (Phase 3): image adjustments, background removal and brush strokes.
  // Nothing to convert: the new fields start at their defaults (filled in by sanitize).
  1: (doc) => doc,
  // v2 → v3 (Phase 4): background, foreground overlays and lighting. The old
  // placeholders hold nothing worth keeping except the light direction.
  2: (doc) => doc,
  // v3 → v4 (Phase 5): pop-out mask strokes start empty (filled in by sanitize).
  3: (doc) => doc,
  // v4 → v5 (Phase 6): effects. Nothing could be added before, so any old
  // placeholder entries are dropped.
  4: (doc) => ({ ...doc, effects: [] }),
  // v5 → v6 (Phase 7): picture frames, decorations and rim softness. Old rims
  // were crisp, so they keep softness 0; old placeholder decorations are dropped.
  5: (doc) => {
    const lighting = obj(doc.lighting);
    return { ...doc, decorations: [], lighting: { ...lighting, rim: { softness: 0, ...obj(lighting.rim) } } };
  },
  // v6 → v7 (Phase 8): the label. Nothing could add one before, so any old placeholder is dropped.
  6: (doc) => ({ ...doc, label: null }),
  // v7 → v8 (owner feedback after Phase 10): the Foreground section joined Effects. Each
  // overlay becomes an effect over the art, drawn below the effects that were already over
  // it (overlays came first). New effect, removal, decoration and label fields start at
  // their defaults (filled in by sanitize). Old flat-colour removal only took the
  // background joined to the edge, so it keeps doing that.
  7: (doc) => {
    const art = obj(doc.art);
    const { foreground, ...rest } = doc;
    return {
      ...rest,
      art: { ...art, removal: { enclosed: false, ...obj(art.removal) } },
      effects: [...arr(foreground).map(overlayToEffect), ...arr(doc.effects)],
    };
  },
  // v8 → v9 (Frame Studio designs as frames): nothing could use one before; `design` starts empty (filled in by sanitize).
  8: (doc) => doc,
};

/** The effect kind each old foreground overlay became (v8). */
const OVERLAY_EFFECT: Record<string, EffectKind> = {
  gradient: 'gradient',
  vignette: 'vignette',
  shadow: 'edgeShadow',
  foliage: 'foliage',
  cobwebs: 'cobwebs',
  mist: 'mist',
  smoke: 'smoke',
};

/** An old foreground overlay as an effect over the art (v8). */
function overlayToEffect(o: Json, index: number): Json {
  const kind = OVERLAY_EFFECT[o.kind as string] ?? 'vignette';
  return {
    id: str(o.id, `overlay-${index}`),
    kind,
    visible: o.visible,
    placement: 'over',
    intensity: typeof o.opacity === 'number' ? o.opacity * 100 : undefined,
    blend: o.blend,
    color: o.color,
    // Overlay "size" (how far it reaches) is the effect's Spread; the old Scale is its Size.
    spread: o.size,
    size: typeof o.scale === 'number' ? (o.scale / 100) * OVERLAY_BASE_SIZE : undefined,
    softness: o.softness,
    angle: o.angle,
    seed: o.seed,
    gradient: o.gradient,
  };
}

export class DocumentVersionError extends Error {}

export function migrateDocument(
  raw: unknown,
  migrations: Record<number, (doc: Json) => Json> = MIGRATIONS,
  target = SCHEMA_VERSION,
): TokenDocument {
  if (!isObject(raw)) return createDocument();
  let doc: Json = raw;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;
  if (version > target) {
    throw new DocumentVersionError('This token was made with a newer version of Token Maker. Reload the page to update.');
  }
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new DocumentVersionError(`No migration from version ${version}.`);
    doc = { ...step(doc), schemaVersion: version + 1 };
    version++;
  }
  return sanitize(doc);
}

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);
const obj = (v: unknown): Json => (isObject(v) ? v : {});
const arr = (v: unknown) => (Array.isArray(v) ? v.filter(isObject) : []);

const BLENDS: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];
const PRESET_IDS = new Set<string>(LIGHT_PRESETS.map((p) => p.id));
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

function gradient(raw: Json, base: Gradient): Gradient {
  const stops = arr(raw.stops)
    .slice(0, 16)
    .map((s) => ({ offset: num(s.offset, 0, 0, 1), color: hex(s.color, '#000000'), opacity: num(s.opacity, 1, 0, 1) }))
    .sort((a, b) => a.offset - b.offset);
  return {
    type: oneOf(raw.type, ['linear', 'radial'] as const, base.type),
    angle: num(raw.angle, base.angle, -360, 360),
    stops: stops.length >= 2 ? stops : copyGradient(base).stops,
  };
}

function background(raw: Json, d: BackgroundLayer): BackgroundLayer {
  const img = obj(raw.image);
  const image: BackgroundImageSource | null =
    img.type === 'library' && typeof img.id === 'string'
      ? { type: 'library', id: img.id }
      : img.type === 'asset' && typeof img.assetId === 'string'
        ? { type: 'asset', assetId: img.assetId }
        : img.type === 'art'
          ? { type: 'art' }
          : null;
  return {
    kind: oneOf(raw.kind, ['none', 'color', 'gradient', 'image'] as const, d.kind),
    opacity: num(raw.opacity, d.opacity, 0, 1),
    color: hex(raw.color, d.color),
    gradient: gradient(obj(raw.gradient), d.gradient),
    image,
    blur: num(raw.blur, d.blur, 0, 100),
    zoom: num(raw.zoom, d.zoom, 0.2, 8),
    offsetX: num(raw.offsetX, d.offsetX, -5, 5),
    offsetY: num(raw.offsetY, d.offsetY, -5, 5),
  };
}

const EFFECT_KINDS: readonly EffectKind[] = EFFECTS.map((e) => e.kind);
const PLACEMENTS: readonly EffectPlacement[] = ['behind', 'over', 'border'];

/** A picture's source: a built-in or uploaded picture id (letters, digits and dashes). */
export function pictureSource(raw: unknown): PictureSource | null {
  const src = obj(raw);
  const id = typeof src.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(src.id) ? src.id : '';
  if (!id || (src.type !== 'library' && src.type !== 'upload')) return null;
  return { type: src.type, id };
}

function effect(raw: Json, index: number): EffectLayer | null {
  if (!EFFECT_KINDS.includes(raw.kind as EffectKind)) return null;
  const d = newEffect(raw.kind as EffectKind, str(raw.id, `effect-${index}`));
  const image = pictureSource(raw.image);
  // A picture effect without its picture has nothing to draw.
  if (d.kind === 'picture' && !image) return null;
  return {
    ...d,
    blend: oneOf(raw.blend, BLENDS, d.blend),
    blur: num(raw.blur, d.blur, 0, 1),
    angle: num(raw.angle, d.angle, -360, 360),
    softness: num(raw.softness, d.softness, 0, 100),
    gradient: gradient(obj(raw.gradient), d.gradient),
    image,
    layout: oneOf(raw.layout, ['scatter', 'fill'] as const, d.layout),
    tint: bool(raw.tint, d.tint),
    visible: bool(raw.visible, d.visible),
    placement: oneOf(raw.placement, PLACEMENTS, d.placement),
    intensity: num(raw.intensity, d.intensity, 0, 100),
    color: hex(raw.color, d.color),
    size: num(raw.size, d.size, 0, 1),
    spread: num(raw.spread, d.spread, 0, 100),
    seed: Math.round(num(raw.seed, d.seed, 0, 1e6)),
  };
}

function lighting(raw: Json, d: LightingSettings): LightingSettings {
  const rim = obj(raw.rim);
  return {
    direction: num(raw.direction, d.direction, -360, 360),
    enabled: bool(raw.enabled, d.enabled),
    preset: typeof raw.preset === 'string' && PRESET_IDS.has(raw.preset) ? (raw.preset as LightPresetId) : null,
    color: hex(raw.color, d.color),
    strength: num(raw.strength, d.strength, 0, 100),
    falloff: num(raw.falloff, d.falloff, 0, 100),
    rim: {
      enabled: bool(rim.enabled, d.rim.enabled),
      strength: num(rim.strength, d.rim.strength, 0, 100),
      width: num(rim.width, d.rim.width, 0, 100),
      softness: num(rim.softness, d.rim.softness, 0, 100),
    },
    background: bool(raw.background, d.background),
  };
}

const DECORATION_KINDS: readonly DecorationKind[] = DECORATIONS.map((x) => x.kind);
const SNAP_POINTS: readonly (SnapPoint | 'free')[] = ['top', 'topRight', 'right', 'bottomRight', 'bottom', 'bottomLeft', 'left', 'topLeft', 'free'];

function decoration(raw: Json, index: number): Decoration | null {
  if (!DECORATION_KINDS.includes(raw.kind as DecorationKind)) return null;
  const id = str(raw.id, `decoration-${index}`);
  const image = pictureSource(raw.image);
  if (raw.kind === 'picture' && !image) return null;
  const d = image && raw.kind === 'picture' ? newPictureDecoration(image, num(raw.aspect, 1, 0.05, 20), undefined, id) : newDecoration(raw.kind as DecorationKind, id);
  return {
    ...d,
    tint: bool(raw.tint, d.tint),
    visible: bool(raw.visible, d.visible),
    place: oneOf(raw.place, SNAP_POINTS, d.place),
    x: num(raw.x, d.x, -1.5, 1.5),
    y: num(raw.y, d.y, -1.5, 1.5),
    size: num(raw.size, d.size, 0.02, 4),
    rotation: num(raw.rotation, d.rotation, -360, 360),
    mirror: bool(raw.mirror, d.mirror),
    flip: bool(raw.flip, d.flip),
    color: hex(raw.color, d.color),
    opacity: num(raw.opacity, d.opacity, 0, 1),
  };
}

const LABEL_SHAPES = ['banner', 'plaque', 'pill', 'box', 'plain', 'ring'] as const;
const LABEL_ANCHORS: readonly LabelAnchor[] = ['topLeft', 'top', 'topRight', 'left', 'center', 'right', 'bottomLeft', 'bottom', 'bottomRight'];
/** Fonts are a built-in id or "upload:<id>": letters, digits and dashes only. */
const FONT_ID = /^(upload:)?[a-zA-Z0-9-]{1,80}$/;

export function label(raw: unknown): LabelSettings | null {
  if (!isObject(raw)) return null;
  const d = newLabel();
  const outline = obj(raw.outline);
  const textOutline = obj(raw.textOutline);
  const shadow = obj(raw.shadow);
  return {
    shape: oneOf(raw.shape, LABEL_SHAPES, d.shape),
    text: typeof raw.text === 'string' ? raw.text.slice(0, 120) : null,
    place: oneOf(raw.place, ['top', 'bottom', 'free'] as const, d.place),
    x: num(raw.x, d.x, -1, 1),
    y: num(raw.y, d.y, -1, 1),
    anchor: oneOf(raw.anchor, LABEL_ANCHORS, d.anchor),
    rotation: num(raw.rotation, d.rotation, -360, 360),
    angle: num(raw.angle, d.angle, -360, 360),
    arc: num(raw.arc, d.arc, 20, 360),
    width: num(raw.width, d.width, 0.1, 8),
    curve: num(raw.curve, d.curve, -100, 100),
    corners: oneOf(raw.corners, ['rounded', 'sharp'] as const, d.corners),
    fill: hex(raw.fill, d.fill),
    opacity: num(raw.opacity, d.opacity, 0, 1),
    outline: { width: num(outline.width, d.outline.width, 0, 0.2), color: hex(outline.color, d.outline.color) },
    font: typeof raw.font === 'string' && FONT_ID.test(raw.font) ? raw.font : d.font,
    size: num(raw.size, d.size, 0.02, 2),
    color: hex(raw.color, d.color),
    bold: bool(raw.bold, d.bold),
    italic: bool(raw.italic, d.italic),
    letterSpacing: num(raw.letterSpacing, d.letterSpacing, -0.1, 0.5),
    align: oneOf(raw.align, ['left', 'center', 'right'] as const, d.align),
    textOutline: { width: num(textOutline.width, d.textOutline.width, 0, 0.2), color: hex(textOutline.color, d.textOutline.color) },
    shadow: {
      enabled: bool(shadow.enabled, d.shadow.enabled),
      color: hex(shadow.color, d.shadow.color),
      opacity: num(shadow.opacity, d.shadow.opacity, 0, 1),
      blur: num(shadow.blur, d.shadow.blur, 0, 0.5),
    },
    shrinkToFit: bool(raw.shrinkToFit, d.shrinkToFit),
  };
}

/** Most points a picture frame's hole may have. */
const MAX_HOLE_POINTS = 512;

export function imageFrame(raw: unknown): ImageFrame | null {
  if (!isObject(raw)) return null;
  const src = obj(raw.source);
  const id = typeof src.id === 'string' ? src.id.slice(0, 80) : '';
  if (!id || (src.type !== 'library' && src.type !== 'upload')) return null;
  const hole = Array.isArray(raw.hole) ? raw.hole.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];
  if (hole.length < 6 || hole.length > MAX_HOLE_POINTS * 2 || hole.length % 2) return null;
  const nudge = obj(raw.nudge);
  return {
    source: { type: src.type, id },
    name: str(raw.name, 'Picture frame').slice(0, 80),
    hole: hole.map((n) => Math.max(-1.5, Math.min(1.5, n))),
    outer: num(raw.outer, 1, 0, 1.5),
    nudge: { x: num(nudge.x, 0, -0.5, 0.5), y: num(nudge.y, 0, -0.5, 0.5), scale: num(nudge.scale, 1, 0.5, 1.5) },
  };
}

/** Most characters a kept Frame Studio design may have (its JSON). */
const MAX_DESIGN_CHARS = 2_000_000;

/** A Frame Studio design frame, checked by Frame Studio's own reader (nothing in it is ever run). */
export function designFrame(raw: unknown): DesignFrame | null {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id.slice(0, 80) : '';
  if (!id || !isObject(raw.project)) return null;
  if (JSON.stringify(raw.project).length > MAX_DESIGN_CHARS) return null;
  const read = readFrameDesign(raw.project);
  if (!read.ok) return null;
  return { id, name: str(raw.name, read.project.name).slice(0, 80), project: read.project };
}

/** Most stroke data any one document keeps (about 2 MB of numbers). */
const MAX_STROKE_NUMBERS = 300_000;

function adjustments(raw: Json): ImageAdjustments {
  const out = { ...DEFAULT_ADJUST };
  for (const key of Object.keys(DEFAULT_ADJUST) as (keyof ImageAdjustments)[]) {
    if (key === 'invert') out.invert = bool(raw.invert, false);
    else {
      const [min, max] = key === 'hue' ? [-180, 180] : ['sharpness', 'blur', 'grayscale', 'sepia'].includes(key) ? [0, 100] : [-100, 100];
      out[key] = num(raw[key], 0, min, max);
    }
  }
  return out;
}

function strokes(raw: unknown): MaskStroke[] {
  return brushStrokes(raw, (m) => (m === 'restore' ? 'restore' : 'erase'));
}

function popOutStrokes(raw: unknown): PopOutStroke[] {
  return brushStrokes(raw, (m) => (m === 'erase' ? 'erase' : 'add'));
}

function brushStrokes<M extends string>(raw: unknown, mode: (m: unknown) => M): (Omit<MaskStroke, 'mode'> & { mode: M })[] {
  const out: (Omit<MaskStroke, 'mode'> & { mode: M })[] = [];
  let total = 0;
  for (const s of arr(raw)) {
    const points = Array.isArray(s.points) ? s.points.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];
    if (points.length < 3 || total + points.length > MAX_STROKE_NUMBERS) continue;
    total += points.length;
    out.push({
      mode: mode(s.mode),
      size: num(s.size, 0.05, 0.0005, 2),
      softness: num(s.softness, 0.5, 0, 1),
      points: points.slice(0, points.length - (points.length % 3)),
    });
  }
  return out;
}

/** Checks every field of a current-version document, using defaults for anything missing or invalid. */
export function sanitize(raw: Json): TokenDocument {
  const d = createDocument();
  const size = obj(raw.size);
  const presetIds = [...SIZE_PRESETS.map((s) => s.id), 'custom'] as string[];
  const preset = presetIds.includes(size.preset as string) ? (size.preset as TokenDocument['size']['preset']) : d.size.preset;
  const known = SIZE_PRESETS.find((s) => s.id === preset);
  const art = obj(raw.art);
  const t = obj(art.transform);
  const frame = obj(raw.frame);
  const frameImage = imageFrame(frame.image);
  const frameDesign = designFrame(frame.design);
  const shadows = obj(raw.shadows);
  const outer = (v: unknown, base: TokenDocument['shadows']['outer']) => {
    const s = obj(v);
    return {
      enabled: bool(s.enabled, base.enabled),
      followLight: bool(s.followLight, base.followLight),
      angle: num(s.angle, base.angle, -360, 360),
      distance: num(s.distance, base.distance, 0, 1),
      blur: num(s.blur, base.blur, 0, 1),
      color: hex(s.color, base.color),
      opacity: num(s.opacity, base.opacity, 0, 1),
    };
  };
  const inner = obj(shadows.inner);
  const assetId = art.assetId;
  const removal = obj(art.removal);
  const removalColor = removal.color === null ? null : hex(removal.color, '');
  const popOut = obj(art.popOut);

  return {
    schemaVersion: SCHEMA_VERSION,
    name: str(raw.name, d.name).slice(0, 120),
    size: {
      preset,
      squares: known ? known.squares : num(size.squares, 1, MIN_SQUARES, MAX_SQUARES),
    },
    shape: SHAPES.some((s) => s.id === raw.shape) ? (raw.shape as TokenDocument['shape']) : d.shape,
    art: {
      assetId: typeof assetId === 'string' ? assetId : null,
      transform: {
        zoom: num(t.zoom, 1, 0.01, 50),
        offsetX: num(t.offsetX, 0, -20, 20),
        offsetY: num(t.offsetY, 0, -20, 20),
        rotation: num(t.rotation, 0, -360, 360),
        flipX: bool(t.flipX, false),
        flipY: bool(t.flipY, false),
        // There is no longer a button for this, so older saves come back unlocked.
        lockFill: false,
      },
      adjust: adjustments(obj(art.adjust)),
      removal: {
        enabled: bool(removal.enabled, d.art.removal.enabled),
        color: removalColor || null,
        intensity: num(removal.intensity, d.art.removal.intensity, 0, 100),
        softness: num(removal.softness, d.art.removal.softness, 0, 100),
        enclosed: bool(removal.enclosed, d.art.removal.enclosed),
        method: oneOf(removal.method, ['colour', 'ai'] as const, d.art.removal.method),
      },
      strokes: strokes(art.strokes),
      popOut: { enabled: bool(popOut.enabled, d.art.popOut.enabled), strokes: popOutStrokes(popOut.strokes) },
    },
    background: background(obj(raw.background), d.background),
    lighting: lighting(obj(raw.lighting), d.lighting),
    effects: arr(raw.effects)
      .map((e, i) => effect(e, i))
      .filter((e): e is EffectLayer => e !== null)
      .slice(0, MAX_EFFECTS),
    frame: {
      kind: frame.kind === 'image' && frameImage ? 'image' : frame.kind === 'design' ? 'design' : 'code',
      presetId: str(frame.presetId, d.frame.presetId),
      style: FRAME_STYLES.has(frame.style as string) ? (frame.style as TokenDocument['frame']['style']) : d.frame.style,
      color: hex(frame.color, d.frame.color),
      highlightColor: frame.highlightColor === null ? null : hex(frame.highlightColor, '') || null,
      thickness: num(frame.thickness, d.frame.thickness, 0, 1),
      outerSpacing: num(frame.outerSpacing, d.frame.outerSpacing, 0, 1),
      innerSpacing: num(frame.innerSpacing, d.frame.innerSpacing, 0, 1),
      backingColor: hex(frame.backingColor, d.frame.backingColor),
      backingOpacity: num(frame.backingOpacity, 1, 0, 1),
      image: frameImage,
      design: frameDesign,
    },
    decorations: arr(raw.decorations)
      .map((x, i) => decoration(x, i))
      .filter((x): x is Decoration => x !== null)
      .slice(0, MAX_DECORATIONS),
    shadows: {
      outer: outer(shadows.outer, d.shadows.outer),
      inner: {
        enabled: bool(inner.enabled, d.shadows.inner.enabled),
        strength: num(inner.strength, d.shadows.inner.strength, 0, 1),
        softness: num(inner.softness, d.shadows.inner.softness, 0, 1),
      },
      popOut: outer(shadows.popOut, d.shadows.popOut),
    },
    label: label(raw.label),
  };
}
