// Loading saved documents safely (DESIGN.md §4.1): older versions are
// upgraded step by step, then everything is checked and filled in from the
// defaults, so a damaged or partial file can never crash the editor.

import { FRAME_STYLES, SHAPES } from '../render/catalog';
import { createDocument, DEFAULT_ADJUST, MAX_SQUARES, MIN_SQUARES, SIZE_PRESETS } from './defaults';
import { SCHEMA_VERSION, type BrushStroke, type ImageAdjustments, type TokenDocument } from './types';

type Json = Record<string, unknown>;

/**
 * Migrations: `MIGRATIONS[n]` turns a version-n document into version n+1.
 * When the document shape changes: bump SCHEMA_VERSION in types.ts and add
 * the step here, with a test in migrate.test.ts.
 */
export const MIGRATIONS: Record<number, (doc: Json) => Json> = {};

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

/** Allowed range of each numeric adjustment (DESIGN.md §6.2). */
export const ADJUST_RANGES: Partial<Record<keyof ImageAdjustments, [number, number]>> = {
  brightness: [-100, 100],
  contrast: [-100, 100],
  saturation: [-100, 100],
  hue: [-180, 180],
  temperature: [-100, 100],
  tint: [-100, 100],
  exposure: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  sharpness: [0, 100],
  blur: [0, 100],
  vibrance: [-100, 100],
  grayscale: [0, 100],
  sepia: [0, 100],
};

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
  const adjust = obj(art.adjust);
  const removal = obj(art.removal);
  const seed = obj(removal.seed);

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
      adjust: Object.fromEntries(
        Object.entries(DEFAULT_ADJUST).map(([k, v]) => {
          const [min, max] = ADJUST_RANGES[k as keyof ImageAdjustments] ?? [0, 0];
          return [k, typeof v === 'boolean' ? bool(adjust[k], v) : num(adjust[k], v, min, max)];
        }),
      ) as unknown as ImageAdjustments,
      removal: {
        enabled: bool(removal.enabled, d.art.removal.enabled),
        color: hex(removal.color, '') || null,
        seed: typeof seed.x === 'number' && typeof seed.y === 'number' ? { x: num(seed.x, 0, 0, 1), y: num(seed.y, 0, 0, 1) } : null,
        intensity: num(removal.intensity, d.art.removal.intensity, 0, 100),
        softness: num(removal.softness, d.art.removal.softness, 0, 100),
      },
      strokes: arr(art.strokes).flatMap((s): BrushStroke[] => {
        const points = Array.isArray(s.points) ? s.points.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];
        if (points.length < 3 || (s.mode !== 'erase' && s.mode !== 'restore')) return [];
        return [
          {
            id: str(s.id, Math.random().toString(36).slice(2)),
            mode: s.mode,
            radius: num(s.radius, 0.02, 0.0005, 1),
            softness: num(s.softness, 0.5, 0, 1),
            points: points.slice(0, points.length - (points.length % 3)),
          },
        ];
      }),
    },
    background: d.background,
    foreground: arr(raw.foreground) as TokenDocument['foreground'],
    lighting: { direction: num(obj(raw.lighting).direction, d.lighting.direction, -360, 360) },
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
