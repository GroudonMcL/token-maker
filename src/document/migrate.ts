// Loading saved documents safely (DESIGN.md §4.1): older versions are
// upgraded step by step, then everything is checked and filled in from the
// defaults, so a damaged or partial file can never crash the editor.

import { FRAME_STYLES, SHAPES } from '../render/catalog';
import { copyGradient, createDocument, DEFAULT_ADJUST, LIGHT_PRESETS, MAX_SQUARES, MIN_SQUARES, newOverlay, SIZE_PRESETS } from './defaults';
import {
  SCHEMA_VERSION,
  type BackgroundImageSource,
  type BackgroundLayer,
  type BlendMode,
  type Gradient,
  type ImageAdjustments,
  type LightingSettings,
  type LightPresetId,
  type MaskStroke,
  type OverlayKind,
  type PopOutStroke,
  type OverlayLayer,
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
};

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

const MAX_OVERLAYS = 12;
const BLENDS: readonly BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];
const OVERLAY_KINDS: readonly OverlayKind[] = ['gradient', 'vignette', 'foliage', 'smoke', 'mist', 'cobwebs', 'shadow'];
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

function overlay(raw: Json, index: number): OverlayLayer {
  const d = newOverlay(oneOf(raw.kind, OVERLAY_KINDS, 'vignette'), str(raw.id, `overlay-${index}`));
  return {
    ...d,
    visible: bool(raw.visible, d.visible),
    opacity: num(raw.opacity, d.opacity, 0, 1),
    blend: oneOf(raw.blend, BLENDS, d.blend),
    color: hex(raw.color, d.color),
    size: num(raw.size, d.size, 0, 100),
    softness: num(raw.softness, d.softness, 0, 100),
    angle: num(raw.angle, d.angle, -360, 360),
    scale: num(raw.scale, d.scale, 50, 200),
    seed: Math.round(num(raw.seed, d.seed, 0, 1e6)),
    gradient: gradient(obj(raw.gradient), d.gradient),
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
    rim: { enabled: bool(rim.enabled, d.rim.enabled), strength: num(rim.strength, d.rim.strength, 0, 100), width: num(rim.width, d.rim.width, 0, 100) },
    background: bool(raw.background, d.background),
  };
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
      },
      strokes: strokes(art.strokes),
      popOut: { enabled: bool(popOut.enabled, d.art.popOut.enabled), strokes: popOutStrokes(popOut.strokes) },
    },
    background: background(obj(raw.background), d.background),
    foreground: arr(raw.foreground).slice(0, MAX_OVERLAYS).map((o, i) => overlay(o, i)),
    lighting: lighting(obj(raw.lighting), d.lighting),
    effects: arr(raw.effects) as TokenDocument['effects'],
    frame: {
      kind: 'code',
      presetId: str(frame.presetId, d.frame.presetId),
      style: FRAME_STYLES.has(frame.style as string) ? (frame.style as TokenDocument['frame']['style']) : d.frame.style,
      color: hex(frame.color, d.frame.color),
      highlightColor: frame.highlightColor === null ? null : hex(frame.highlightColor, '') || null,
      thickness: num(frame.thickness, d.frame.thickness, 0, 1),
      outerSpacing: num(frame.outerSpacing, d.frame.outerSpacing, 0, 1),
      innerSpacing: num(frame.innerSpacing, d.frame.innerSpacing, 0, 1),
      backingColor: hex(frame.backingColor, d.frame.backingColor),
      backingOpacity: num(frame.backingOpacity, 1, 0, 1),
    },
    decorations: arr(raw.decorations) as TokenDocument['decorations'],
    shadows: {
      outer: outer(shadows.outer, d.shadows.outer),
      inner: {
        enabled: bool(inner.enabled, d.shadows.inner.enabled),
        strength: num(inner.strength, d.shadows.inner.strength, 0, 1),
        softness: num(inner.softness, d.shadows.inner.softness, 0, 1),
      },
      popOut: outer(shadows.popOut, d.shadows.popOut),
    },
    label: isObject(raw.label) && typeof raw.label.text === 'string' ? (raw.label as TokenDocument['label']) : null,
  };
}
