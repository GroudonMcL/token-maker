// Reading saved projects (files, autosave, the data view). Old versions are
// migrated one step at a time, then every field is checked: a bad value falls
// back to its default with a warning, and a layer this version can't read is
// kept as an "unsupported" layer rather than silently dropped.

import { FRAME_STYLES, SHAPES } from '../../render/catalog';
import { isValidHex } from '../../render/color';
import { cellsLayer, chainLayer, LAYER_PHASE9, DEFAULT_STAGE, fractureLayer, gearsLayer, growthLayer, knotworkLayer, NEW_EFFECT, NEW_LAYER, NO_RADIAL, REPEAT_PHASE7, REPEAT_V10, newId, textureLayer } from './defaults';
import { PICTURE_IDS } from './pictures';
import {
  BEVEL_PROFILES,
  BLEND_MODES,
  EFFECT_KINDS,
  SURFACES,
  CLIP_MODES,
  DEFAULT_LIGHT,
  ELEMENT_KINDS,
  CELL_PATTERNS,
  COMBINE_MODES,
  HEIGHT_MODES,
  FRACTURE_KINDS,
  GEM_CUTS,
  GROWTH_EXTRAS,
  GROWTH_KINDS,
  GEM_SETTINGS,
  MIRROR_MODES,
  REPEAT_ORIENTS,
  TEXT_FONTS,
  PROJECT_FORMAT,
  SCHEMA_VERSION,
  SHAPE_KINDS,
  TEXTURE_KINDS,
  TEXTURE_PLACES,
  type Effect,
  WAVE_SHAPES,
  type FrameProject,
  type GradientStop,
  type Layer,
  type LayerMask,
  type Paint,
  type PathPoint,
  type Placement,
  type PlacedStyle,
  type StageSettings,
} from './types';

export type ParseResult = { ok: true; project: FrameProject; warnings: string[] } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Version 1 → 2 (Phase 2): the light direction, clipping, wavy lines and repeat patterns, all off by default so old designs look the same. */
function addPhase2Fields(layer: unknown): unknown {
  if (!isObj(layer)) return layer;
  const out: Obj = { clip: 'none', ...layer };
  if (layer.type === 'line') Object.assign(out, { waveAmplitude: 0, waves: 12, wavePhase: 0 }, layer);
  if (layer.type === 'repeat') Object.assign(out, { altColors: [], altSizes: [], skipAroundAccent: 0, alternateSides: 0 }, layer);
  return out;
}

/**
 * Version 3 → 4 (Phase 4): a lit paint's own highlight colour, see-through
 * gradient colours, gradients that turn with the light, and repeats drawn
 * flat or only some of them; all off so old designs look the same.
 */
function addPhase4Fields(layer: unknown): unknown {
  if (!isObj(layer)) return layer;
  const out: Obj = { ...layer };
  if (Array.isArray(layer.children)) out.children = layer.children.map(addPhase4Fields);
  if (layer.type === 'repeat') Object.assign(out, { shaded: true, show: [] }, layer);
  // Only the kinds that have a paint: a layer from a newer version is kept exactly as it was.
  if ((layer.type === 'bandFill' || layer.type === 'line') && isObj(layer.paint)) {
    const paint: Obj = { ...layer.paint };
    if (paint.kind === 'lit') paint.highlight ??= null;
    if (paint.kind === 'linear') paint.followLight ??= false;
    if (Array.isArray(paint.stops) && (paint.kind === 'linear' || paint.kind === 'acrossBand')) paint.stops = paint.stops.map((s) => (isObj(s) ? { opacity: 1, ...s } : s));
    out.paint = paint;
  }
  return out;
}

/**
 * Version 9 → 10: shaped and raised waves on lines; second colours, counts in
 * multiples, wandering and paint fills on repeats; ornaments as shapes and
 * paint fills on shapes and paths. All off, so old designs look the same; the
 * new textures, ornaments and the photo paint are new kinds.
 */
function addVersion10Fields(layer: unknown): unknown {
  if (!isObj(layer) || !KNOWN_TYPES.has(layer.type as string)) return layer;
  const out: Obj = { ...layer };
  if (Array.isArray(layer.children)) out.children = layer.children.map(addVersion10Fields);
  if (layer.type === 'line') Object.assign(out, { waveShape: 'sine', raised: false }, layer);
  if (layer.type === 'repeat') Object.assign(out, REPEAT_V10, layer);
  if (layer.type === 'shape') Object.assign(out, { element: 'heart', detail: null }, layer);
  if (layer.type === 'shape' || layer.type === 'path') Object.assign(out, { fillPaint: null, paintEach: false }, layer);
  return out;
}

const KNOWN_TYPES = new Set(['legacyFrame', 'bandFill', 'line', 'repeat', 'texture', 'shape', 'path', 'group', 'text', 'contours']);
// Kinds added later need no migrations for earlier versions (they didn't exist).

/**
 * Version 4 → 5 (Phase 6): effects on every layer and faceted shapes and
 * paths, all off so old designs look the same. A layer of a kind this
 * version doesn't know is left exactly as it was.
 */
function addPhase6Fields(layer: unknown): unknown {
  if (!isObj(layer) || !KNOWN_TYPES.has(layer.type as string)) return layer;
  const out: Obj = { effects: [], ...layer };
  if (Array.isArray(layer.children)) out.children = layer.children.map(addPhase6Fields);
  if (layer.type === 'shape' || layer.type === 'path') Object.assign(out, { faceted: false, facetTable: 0.5, facetDepth: 1 }, out);
  return out;
}

/**
 * Version 5 → 6 (Phase 7): repeats can follow a path and vary, gems have
 * cuts and settings, shapes and paths radial arrays; all off (Phase 6's
 * brilliant cut) so old designs look the same. Text and contour layers are
 * new kinds, so nothing else changes.
 */
function addPhase7Fields(layer: unknown): unknown {
  if (!isObj(layer) || !KNOWN_TYPES.has(layer.type as string)) return layer;
  const out: Obj = { ...layer };
  if (Array.isArray(layer.children)) out.children = layer.children.map(addPhase7Fields);
  if (layer.type === 'repeat') Object.assign(out, structuredClone(REPEAT_PHASE7), layer);
  if (layer.type === 'shape' || layer.type === 'path') Object.assign(out, NO_RADIAL, layer);
  return out;
}

/**
 * Version 6 → 7 (Phase 8): lines get waves fitted to the band switched off
 * and wear no scratches; the generators are new kinds and distortion a new
 * effect, so nothing else changes.
 */
function addPhase8Fields(layer: unknown): unknown {
  if (!isObj(layer) || !KNOWN_TYPES.has(layer.type as string)) return layer;
  const out: Obj = { ...layer };
  if (Array.isArray(layer.children)) out.children = layer.children.map(addPhase8Fields);
  if (layer.type === 'line') out.waveFit ??= 0;
  const noScratches = (effects: unknown) => (Array.isArray(effects) ? effects.map((e) => (isObj(e) && e.kind === 'wear' ? { scratches: 0, ...e } : e)) : effects);
  if ('effects' in out) out.effects = noScratches(out.effects);
  if ('settingEffects' in out) out.settingEffects = noScratches(out.settingEffects);
  return out;
}

/** Migrations from version n to n + 1, keyed by n. */
const MIGRATIONS: Record<number, (p: Obj) => Obj> = {
  1: (p) => ({
    ...p,
    schemaVersion: 2,
    stage: { ...(isObj(p.stage) ? p.stage : {}), light: DEFAULT_LIGHT },
    layers: Array.isArray(p.layers) ? p.layers.map(addPhase2Fields) : p.layers,
  }),
  // Version 2 → 3 (Phase 3) only adds things (texture layers, the ring paint), so nothing changes.
  2: (p) => ({ ...p, schemaVersion: 3 }),
  3: (p) => ({ ...p, schemaVersion: 4, layers: Array.isArray(p.layers) ? p.layers.map(addPhase4Fields) : p.layers }),
  4: (p) => ({ ...p, schemaVersion: 5, layers: Array.isArray(p.layers) ? p.layers.map(addPhase6Fields) : p.layers }),
  5: (p) => ({ ...p, schemaVersion: 6, layers: Array.isArray(p.layers) ? p.layers.map(addPhase7Fields) : p.layers }),
  6: (p) => ({ ...p, schemaVersion: 7, layers: Array.isArray(p.layers) ? p.layers.map(addPhase8Fields) : p.layers }),
  // Version 7 → 8 (Phase 9): masks, shared height, combining groups, tapered strokes and separate handles are all
  // off when left out, which is how earlier files have them, so nothing changes.
  7: (p) => ({ ...p, schemaVersion: 8 }),
  // Version 8 → 9 (Phase 10): the lighting rig is off when a file leaves it out, so nothing changes.
  8: (p) => ({ ...p, schemaVersion: 9 }),
  // Version 9 → 10: the second branch's ornaments, textures, wave shapes and paint fills, all off.
  9: (p) => ({ ...p, schemaVersion: 10, layers: Array.isArray(p.layers) ? p.layers.map(addVersion10Fields) : p.layers }),
};

export function parseProject(input: unknown): ParseResult {
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, error: "This isn't a Frame Studio project file (it isn't valid JSON)." };
    }
  }
  if (!isObj(raw) || raw.format !== PROJECT_FORMAT) {
    return { ok: false, error: "This isn't a Frame Studio project file." };
  }
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: `This project was made with a newer Frame Studio (format ${version}); this one reads up to ${SCHEMA_VERSION}.` };
  }
  if (version < 1) return { ok: false, error: 'This project file has no valid format version.' };
  let p: Obj = raw;
  while (version < SCHEMA_VERSION) {
    p = MIGRATIONS[version](p);
    version++;
  }
  const warnings: string[] = [];
  const layers = checkLayers(p.layers, warnings, new Set<string>(), 0);
  if (!Array.isArray(p.layers)) warnings.push('The project had no layer list; it starts empty.');
  return {
    ok: true,
    warnings,
    project: {
      format: PROJECT_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Untitled frame',
      stage: checkStage(p.stage),
      layers,
    },
  };
}

function checkStage(s: unknown): StageSettings {
  const o = isObj(s) ? s : {};
  return {
    shape: SHAPES.some((x) => x.id === o.shape) ? (o.shape as StageSettings['shape']) : DEFAULT_STAGE.shape,
    thickness: num(o.thickness, DEFAULT_STAGE.thickness, 0.01, 0.6),
    outerSpacing: num(o.outerSpacing, DEFAULT_STAGE.outerSpacing, 0, 0.5),
    showArt: typeof o.showArt === 'boolean' ? o.showArt : DEFAULT_STAGE.showArt,
    backingColor: hex(o.backingColor, DEFAULT_STAGE.backingColor),
    light: ((num(o.light, DEFAULT_STAGE.light, -720, 720) % 360) + 360) % 360,
    lights: Array.isArray(o.lights)
      ? o.lights
          .filter(isObj)
          .slice(0, 4)
          .map((l) => ({ angle: ((num(l.angle, 45, -720, 720) % 360) + 360) % 360, color: hex(l.color, '#ffffff'), strength: num(l.strength, 0.8, 0, 2), height: num(l.height, 25, 10, 90) }))
      : [],
    ambient: hex(o.ambient, DEFAULT_STAGE.ambient),
    ambientStrength: num(o.ambientStrength, 0, 0, 1),
    bloom: num(o.bloom, 0, 0, 1),
    bleed: num(o.bleed, 0, 0, 1),
  };
}

/** Groups can hold groups, but not without end. */
const MAX_DEPTH = 8;

function checkLayers(v: unknown, warnings: string[], ids: Set<string>, depth: number): Layer[] {
  if (!Array.isArray(v)) return [];
  return v.map((l, i) => {
    const layer = checkLayer(l, i, warnings, ids, depth);
    // Ids must be unique; a clash (e.g. a hand-edited file) gets a fresh one.
    if (ids.has(layer.id)) layer.id = newId();
    ids.add(layer.id);
    return layer;
  });
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && isValidHex(v) ? v.toLowerCase() : fallback);
const hexOrNull = (v: unknown, fallback: string | null) => (v === null ? null : typeof v === 'string' && isValidHex(v) ? v.toLowerCase() : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

function checkStops(v: unknown, fallback: GradientStop[]): GradientStop[] {
  if (!Array.isArray(v)) return fallback;
  const stops = v.filter(isObj).map((s) => ({ at: num(s.at, 0, 0, 1), color: hex(s.color, '#ffffff'), opacity: num(s.opacity, 1, 0, 1) }));
  return stops.length >= 2 ? stops.slice(0, 16).sort((a, b) => a.at - b.at) : fallback;
}

function checkPaint(v: unknown, fallback: Paint): Paint {
  const o = isObj(v) ? v : {};
  const fbColor = 'color' in fallback ? fallback.color : '#ffffff';
  const fbStops = fallback.kind === 'linear' || fallback.kind === 'acrossBand' ? fallback.stops : [{ at: 0, color: '#ffffff', opacity: 1 }, { at: 1, color: '#000000', opacity: 1 }];
  switch (o.kind) {
    case 'solid':
      return { kind: 'solid', color: hex(o.color, fbColor) };
    case 'lit':
      return {
        kind: 'lit',
        color: hex(o.color, fbColor),
        light: num(o.light, 0.85, 0, 1),
        dark: num(o.dark, 0.8, 0, 1),
        pressed: bool(o.pressed, false),
        highlight: hexOrNull(o.highlight, null),
      };
    case 'linear':
      return { kind: 'linear', angle: num(o.angle, 45, -360, 360), stops: checkStops(o.stops, fbStops), followLight: bool(o.followLight, false) };
    case 'acrossBand':
      return { kind: 'acrossBand', stops: checkStops(o.stops, fbStops) };
    case 'picture':
      return {
        kind: 'picture',
        picture: oneOf(o.picture, PICTURE_IDS, PICTURE_IDS[0]),
        scale: num(o.scale, 3, 0.2, 40),
        angle: num(o.angle, 0, -360, 360),
        bend: bool(o.bend, true),
        tint: hexOrNull(o.tint, null),
        lighting: num(o.lighting, 0.5, 0, 1),
      };
    case 'ring': {
      const stops = Array.isArray(o.stops)
        ? o.stops
            .filter(isObj)
            .slice(0, 36)
            .map((s) => ({ angle: Math.round(((num(s.angle, 0, -720, 720) % 360) + 360) % 360 * 10) / 10, color: hex(s.color, '#ffffff') }))
            .sort((a, b) => a.angle - b.angle)
        : [];
      if (stops.length < 2) return fallback;
      return { kind: 'ring', stops, followLight: bool(o.followLight, true) };
    }
    default:
      return fallback;
  }
}

function checkPlacement(o: Obj, d: Placement): Placement {
  return {
    place: oneOf(o.place, ['band', 'free'] as const, d.place),
    along: (((num(o.along, d.along, -10, 10) % 1) + 1) % 1),
    across: num(o.across, d.across, -0.5, 1.5),
    x: num(o.x, d.x, -2, 2),
    y: num(o.y, d.y, -2, 2),
    size: num(o.size, d.size, 0.01, 5),
    stretch: num(o.stretch, d.stretch, 0.1, 5),
    rotation: num(o.rotation, d.rotation, -360, 360),
    mirror: oneOf(o.mirror, MIRROR_MODES, d.mirror),
    radialCount: Math.round(num(o.radialCount, d.radialCount, 1, 64)),
    radialRadius: num(o.radialRadius, d.radialRadius, 0, 5),
    radialStart: num(o.radialStart, d.radialStart, -360, 360),
    radialMirror: bool(o.radialMirror, d.radialMirror),
  };
}

const idOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);

function checkMask(v: unknown): LayerMask | null {
  if (!isObj(v) || typeof v.source !== 'string' || !v.source) return null;
  return { source: v.source, mode: oneOf(v.mode, ['alpha', 'luminance'] as const, 'alpha'), invert: bool(v.invert, false) };
}
const DASHES = ['solid', 'dashed', 'dotted'] as const;

/** Effects: up to 12; an effect of an unknown kind is left out with a warning. */
export function checkEffects(v: unknown, name: string, warnings: string[]): Effect[] {
  if (!Array.isArray(v)) return [];
  const out: Effect[] = [];
  for (const e of v.slice(0, 12)) {
    if (!isObj(e) || !EFFECT_KINDS.includes(e.kind as Effect['kind'])) {
      warnings.push(`Layer "${name}" had an effect this version doesn't know; it was left out.`);
      continue;
    }
    const d = NEW_EFFECT[e.kind as Effect['kind']]();
    const on = bool(e.on, true);
    switch (d.kind) {
      case 'bevel':
        out.push({
          kind: 'bevel',
          on,
          direction: oneOf(e.direction, ['raised', 'sunken'] as const, d.direction),
          profile: oneOf(e.profile, BEVEL_PROFILES, d.profile),
          size: num(e.size, d.size, 0.005, 2),
          depth: num(e.depth, d.depth, 0, 4),
          soften: num(e.soften, d.soften, 0, 0.5),
          highlight: hex(e.highlight, d.highlight),
          highlightOpacity: num(e.highlightOpacity, d.highlightOpacity, 0, 1),
          shadow: hex(e.shadow, d.shadow),
          shadowOpacity: num(e.shadowOpacity, d.shadowOpacity, 0, 1),
          gloss: num(e.gloss, d.gloss, 0, 1),
          lightHeight: num(e.lightHeight, d.lightHeight, 10, 90),
          surface: oneOf(e.surface, SURFACES, d.surface),
          surfaceDepth: num(e.surfaceDepth, d.surfaceDepth, 0, 2),
          surfaceScale: num(e.surfaceScale, d.surfaceScale, 0.02, 2),
          seed: Math.round(num(e.seed, d.seed, 0, 99999)),
        });
        break;
      case 'shadow':
        out.push({ kind: 'shadow', on, inner: bool(e.inner, d.inner), color: hex(e.color, d.color), opacity: num(e.opacity, d.opacity, 0, 1), distance: num(e.distance, d.distance, 0, 1), blur: num(e.blur, d.blur, 0, 1) });
        break;
      case 'glow':
        out.push({ kind: 'glow', on, inner: bool(e.inner, d.inner), color: hex(e.color, d.color), opacity: num(e.opacity, d.opacity, 0, 1), size: num(e.size, d.size, 0.005, 2) });
        break;
      case 'recolour':
        out.push({ kind: 'recolour', on, stops: checkStops(e.stops, d.stops), amount: num(e.amount, d.amount, 0, 1) });
        break;
      case 'adjust':
        out.push({
          kind: 'adjust',
          on,
          hue: num(e.hue, 0, -180, 180),
          saturation: num(e.saturation, 0, -1, 1),
          brightness: num(e.brightness, 0, -1, 1),
          contrast: num(e.contrast, 0, -1, 1),
        });
        break;
      case 'wear':
        out.push({
          kind: 'wear',
          on,
          chips: num(e.chips, d.chips, 0, 1),
          polish: num(e.polish, d.polish, 0, 1),
          grime: num(e.grime, d.grime, 0, 1),
          grimeColor: hex(e.grimeColor, d.grimeColor),
          scale: num(e.scale, d.scale, 0.02, 2),
          seed: Math.round(num(e.seed, d.seed, 0, 99999)),
          scratches: num(e.scratches, d.scratches, 0, 1),
        });
        break;
      case 'distort':
        out.push({ kind: 'distort', on, amount: num(e.amount, d.amount, 0, 0.5), scale: num(e.scale, d.scale, 0.02, 3), seed: Math.round(num(e.seed, d.seed, 0, 99999)) });
        break;
      case 'extrude':
        out.push({ kind: 'extrude', on, depth: num(e.depth, d.depth, 0, 0.6), shade: num(e.shade, d.shade, 0, 1) });
        break;
      case 'offset':
        out.push({ kind: 'offset', on, amount: num(e.amount, d.amount, -0.5, 0.5) });
        break;
    }
  }
  return out;
}

function checkStyle(o: Obj, d: PlacedStyle): PlacedStyle {
  return {
    faceted: bool(o.faceted, d.faceted),
    facetTable: num(o.facetTable, d.facetTable, 0, 0.95),
    facetDepth: num(o.facetDepth, d.facetDepth, 0.2, 3),
    fill: hexOrNull(o.fill, d.fill),
    shaded: bool(o.shaded, d.shaded),
    outline: hexOrNull(o.outline, d.outline),
    outlineWidth: num(o.outlineWidth, d.outlineWidth, 0, 0.5),
    raised: bool(o.raised, d.raised),
    glow: hexOrNull(o.glow, d.glow),
    fillPaint: checkFillPaint(o.fillPaint),
    paintEach: bool(o.paintEach, d.paintEach),
  };
}

/** A fill paint: a paint, or null for the plain colour. */
const checkFillPaint = (v: unknown): Paint | null => (isObj(v) ? checkPaint(v, { kind: 'solid', color: '#ffffff' }) : null);

const MAX_POINTS = 500;

function checkPoints(v: unknown): PathPoint[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObj)
    .slice(0, MAX_POINTS)
    .map((p) => ({
      x: num(p.x, 0, -50, 50),
      y: num(p.y, 0, -50, 50),
      handle: isObj(p.handle) ? { x: num(p.handle.x, 0, -50, 50), y: num(p.handle.y, 0, -50, 50) } : null,
      ...(isObj(p.handleIn) && isObj(p.handle) ? { handleIn: { x: num(p.handleIn.x, 0, -50, 50), y: num(p.handleIn.y, 0, -50, 50) } } : {}),
    }));
}

function checkLayer(l: unknown, index: number, warnings: string[], ids: Set<string>, depth: number): Layer {
  const o = isObj(l) ? l : {};
  const type = typeof o.type === 'string' ? o.type : '(none)';
  const common = {
    id: typeof o.id === 'string' && o.id ? o.id : newId(),
    name: typeof o.name === 'string' ? o.name : `Layer ${index + 1}`,
    visible: bool(o.visible, true),
    locked: bool(o.locked, false),
    opacity: num(o.opacity, 1, 0, 1),
    blend: oneOf(o.blend, BLEND_MODES, 'source-over'),
    clip: oneOf(o.clip, CLIP_MODES, 'none'),
    effects: [] as Effect[],
    mask: checkMask(o.mask),
    heightMode: oneOf(o.heightMode, HEIGHT_MODES, 'none'),
    heightDepth: num(o.heightDepth, LAYER_PHASE9.heightDepth, 0, 3),
    heightSize: num(o.heightSize, LAYER_PHASE9.heightSize, 0.01, 2),
  };
  if (!(type in NEW_LAYER) || (type === 'group' && depth >= MAX_DEPTH)) {
    warnings.push(`Layer "${common.name}" is a kind this version can't draw (${type}); it is kept but hidden from the picture.`);
    const { id: _id, name: _n, visible: _v, locked: _l, opacity: _o, blend: _b, ...data } = o;
    return { ...common, type: 'unsupported', originalType: type, data, reason: `Unknown layer kind "${type}".` };
  }
  common.effects = checkEffects(o.effects, common.name, warnings);
  switch (type) {
    case 'legacyFrame': {
      const d = NEW_LAYER.legacyFrame();
      if (d.type !== 'legacyFrame') throw new Error('unreachable');
      if (typeof o.style === 'string' && !FRAME_STYLES.has(o.style)) warnings.push(`Layer "${common.name}" used an unknown frame style; it is now Stamped.`);
      return {
        ...common,
        type,
        presetId: typeof o.presetId === 'string' ? o.presetId : d.presetId,
        style: typeof o.style === 'string' && FRAME_STYLES.has(o.style) ? (o.style as typeof d.style) : d.style,
        color: hex(o.color, d.color),
        accent: hexOrNull(o.accent, null),
      };
    }
    case 'bandFill': {
      const d = NEW_LAYER.bandFill();
      if (d.type !== 'bandFill') throw new Error('unreachable');
      return { ...common, type, from: num(o.from, d.from, -0.5, 1.5), to: num(o.to, d.to, -0.5, 1.5), paint: checkPaint(o.paint, d.paint) };
    }
    case 'line': {
      const d = NEW_LAYER.line();
      if (d.type !== 'line') throw new Error('unreachable');
      return {
        ...common,
        type,
        at: num(o.at, d.at, -0.5, 1.5),
        width: num(o.width, d.width, 0.001, 2),
        paint: checkPaint(o.paint, d.paint),
        dash: oneOf(o.dash, DASHES, 'solid'),
        glow: hexOrNull(o.glow, null),
        waveAmplitude: num(o.waveAmplitude, d.waveAmplitude, 0, 2),
        waves: Math.round(num(o.waves, d.waves, 1, 200)),
        wavePhase: num(o.wavePhase, d.wavePhase, 0, 1),
        waveFit: num(o.waveFit, d.waveFit, 0, 20),
        waveShape: oneOf(o.waveShape, WAVE_SHAPES, d.waveShape),
        raised: bool(o.raised, d.raised),
      };
    }
    case 'shape': {
      const d = NEW_LAYER.shape();
      if (d.type !== 'shape') throw new Error('unreachable');
      return {
        ...common,
        type,
        ...checkPlacement(o, d),
        ...checkStyle(o, d),
        shape: oneOf(o.shape, SHAPE_KINDS, d.shape),
        sides: Math.round(num(o.sides, d.sides, 3, 24)),
        innerRatio: num(o.innerRatio, d.innerRatio, 0.05, 1),
        corner: num(o.corner, d.corner, 0, 1),
        element: oneOf(o.element, ELEMENT_KINDS, d.element),
        detail: hexOrNull(o.detail, d.detail),
      };
    }
    case 'path': {
      const d = NEW_LAYER.path();
      if (d.type !== 'path') throw new Error('unreachable');
      return {
        ...common,
        type,
        ...checkPlacement(o, d),
        ...checkStyle(o, d),
        points: checkPoints(o.points),
        closed: bool(o.closed, d.closed),
        stroke: num(o.stroke, d.stroke, 0, 2),
        taperStart: num(o.taperStart, d.taperStart, 0, 1),
        taperEnd: num(o.taperEnd, d.taperEnd, 0, 1),
      };
    }
    case 'text': {
      const d = NEW_LAYER.text();
      if (d.type !== 'text') throw new Error('unreachable');
      return {
        ...common,
        type,
        text: typeof o.text === 'string' ? o.text.slice(0, 200) : d.text,
        font: oneOf(o.font, TEXT_FONTS, d.font),
        size: num(o.size, d.size, 0.05, 3),
        spacing: num(o.spacing, d.spacing, -0.5, 3),
        at: num(o.at, d.at, -0.5, 1.5),
        along: (((num(o.along, d.along, -10, 10) % 1) + 1) % 1),
        align: oneOf(o.align, ['centre', 'start'] as const, d.align),
        reverse: bool(o.reverse, d.reverse),
        follow: idOrNull(o.follow),
        fill: hex(o.fill, d.fill),
        outline: hexOrNull(o.outline, d.outline),
        outlineWidth: num(o.outlineWidth, d.outlineWidth, 0, 0.5),
      };
    }
    case 'contours': {
      const d = NEW_LAYER.contours();
      if (d.type !== 'contours') throw new Error('unreachable');
      return {
        ...common,
        type,
        count: Math.round(num(o.count, d.count, 1, 24)),
        from: num(o.from, d.from, -0.5, 1.5),
        spacing: num(o.spacing, d.spacing, 0, 1),
        width: num(o.width, d.width, 0.002, 1),
        taper: num(o.taper, d.taper, -1, 0.95),
        paint: checkPaint(o.paint, d.paint),
        altColor: hexOrNull(o.altColor, null),
        dash: oneOf(o.dash, DASHES, 'solid'),
      };
    }
    case 'growth': {
      const kind = oneOf(o.kind, GROWTH_KINDS, 'vine');
      const d = growthLayer(kind);
      return {
        ...common,
        type,
        kind,
        follow: idOrNull(o.follow),
        at: num(o.at, d.at, -0.5, 1.5),
        count: Math.round(num(o.count, d.count, 1, 48)),
        waveLength: num(o.waveLength, d.waveLength, 0, 20),
        amplitude: num(o.amplitude, d.amplitude, 0, 2),
        gnarl: num(o.gnarl, d.gnarl, 0, 1),
        thickness: num(o.thickness, d.thickness, 0.005, 1),
        taper: num(o.taper, d.taper, 0, 1),
        branching: num(o.branching, d.branching, 0, 1),
        branchLength: num(o.branchLength, d.branchLength, 0.05, 4),
        branchAngle: num(o.branchAngle, d.branchAngle, 0, 120),
        curl: num(o.curl, d.curl, -1000, 1000),
        depth: Math.round(num(o.depth, d.depth, 1, 3)),
        extra: oneOf(o.extra, GROWTH_EXTRAS, d.extra),
        extraSpacing: num(o.extraSpacing, d.extraSpacing, 0.1, 5),
        extraSize: num(o.extraSize, d.extraSize, 0.05, 2),
        color: hex(o.color, d.color),
        extraColor: hex(o.extraColor, d.extraColor),
        seed: Math.round(num(o.seed, d.seed, 0, 99999)),
      };
    }
    case 'fracture': {
      const d = fractureLayer();
      return {
        ...common,
        type,
        kind: oneOf(o.kind, FRACTURE_KINDS, d.kind),
        from: num(o.from, d.from, -0.5, 1.5),
        to: num(o.to, d.to, -0.5, 1.5),
        count: Math.round(num(o.count, d.count, 1, 60)),
        length: num(o.length, d.length, 0.1, 10),
        branching: num(o.branching, d.branching, 0, 1),
        jagged: num(o.jagged, d.jagged, 0, 1),
        width: num(o.width, d.width, 0.005, 0.5),
        color: hex(o.color, d.color),
        seed: Math.round(num(o.seed, d.seed, 0, 99999)),
      };
    }
    case 'cells': {
      const d = cellsLayer();
      return {
        ...common,
        type,
        pattern: oneOf(o.pattern, CELL_PATTERNS, d.pattern),
        from: num(o.from, d.from, -0.5, 1.5),
        to: num(o.to, d.to, -0.5, 1.5),
        size: num(o.size, d.size, 0.08, 3),
        gap: num(o.gap, d.gap, 0, 0.5),
        jitter: num(o.jitter, d.jitter, 0, 1),
        rounding: num(o.rounding, d.rounding, 0, 1),
        missing: num(o.missing, d.missing, 0, 0.95),
        vary: num(o.vary, d.vary, 0, 1),
        color: hex(o.color, d.color),
        seed: Math.round(num(o.seed, d.seed, 0, 99999)),
      };
    }
    case 'knotwork': {
      const d = knotworkLayer();
      return {
        ...common,
        type,
        follow: idOrNull(o.follow),
        at: num(o.at, d.at, -0.5, 1.5),
        waveLength: num(o.waveLength, d.waveLength, 0.2, 10),
        amplitude: num(o.amplitude, d.amplitude, 0, 2),
        width: num(o.width, d.width, 0.01, 1),
        color: hex(o.color, d.color),
        outline: hexOrNull(o.outline, d.outline),
        outlineWidth: num(o.outlineWidth, d.outlineWidth, 0, 0.3),
        outlineOpacity: num(o.outlineOpacity, d.outlineOpacity, 0, 1),
        shine: bool(o.shine, d.shine),
        double: bool(o.double, d.double),
        flip: bool(o.flip, d.flip),
      };
    }
    case 'gears': {
      const d = gearsLayer();
      return {
        ...common,
        type,
        follow: idOrNull(o.follow),
        at: num(o.at, d.at, -0.5, 1.5),
        count: Math.round(num(o.count, d.count, 1, 96)),
        snapToCorners: bool(o.snapToCorners, d.snapToCorners),
        size: num(o.size, d.size, 0.05, 4),
        teeth: Math.round(num(o.teeth, d.teeth, 3, 48)),
        toothDepth: num(o.toothDepth, d.toothDepth, 0, 0.6),
        toothShape: oneOf(o.toothShape, ['square', 'pointed'] as const, d.toothShape),
        spokes: Math.round(num(o.spokes, d.spokes, 0, 12)),
        hub: num(o.hub, d.hub, 0, 0.9),
        domed: bool(o.domed, d.domed),
        altSize: num(o.altSize, d.altSize, 0.2, 3),
        interlock: bool(o.interlock, d.interlock),
        rotation: num(o.rotation, d.rotation, -360, 360),
        offset: num(o.offset, d.offset, 0, 1),
        color: hex(o.color, d.color),
        shaded: bool(o.shaded, d.shaded),
      };
    }
    case 'chain': {
      const d = chainLayer();
      return {
        ...common,
        type,
        follow: idOrNull(o.follow),
        at: num(o.at, d.at, -0.5, 1.5),
        linkLength: num(o.linkLength, d.linkLength, 0.05, 4),
        linkWidth: num(o.linkWidth, d.linkWidth, 0.2, 1.5),
        thickness: num(o.thickness, d.thickness, 0.01, 1),
        color: hex(o.color, d.color),
        shaded: bool(o.shaded, d.shaded),
      };
    }
    case 'group':
      return { ...common, type, children: checkLayers(o.children, warnings, ids, depth + 1), collapsed: bool(o.collapsed, false), combine: oneOf(o.combine, COMBINE_MODES, 'normal') };
    case 'texture': {
      const kind = oneOf(o.kind, TEXTURE_KINDS, 'marble');
      const d = textureLayer(kind);
      return {
        ...common,
        type,
        kind,
        from: num(o.from, d.from, -0.5, 1.5),
        to: num(o.to, d.to, -0.5, 1.5),
        color: hex(o.color, d.color),
        color2: hexOrNull(o.color2, d.color2),
        amount: num(o.amount, d.amount, 0, 4),
        scale: num(o.scale, d.scale, 0.1, 4),
        strength: num(o.strength, d.strength, 0, 3),
        where: oneOf(o.where, TEXTURE_PLACES, d.where),
        seed: Math.round(num(o.seed, d.seed, 0, 0xffffffff)),
      };
    }
    default: {
      const d = NEW_LAYER.repeat();
      if (d.type !== 'repeat') throw new Error('unreachable');
      return {
        ...common,
        type: 'repeat',
        element: oneOf(o.element, ELEMENT_KINDS, d.element),
        mode: oneOf(o.mode, ['count', 'spacing'] as const, d.mode),
        count: Math.round(num(o.count, d.count, 1, 400)),
        spacing: num(o.spacing, d.spacing, 0.05, 20),
        snapToCorners: bool(o.snapToCorners, d.snapToCorners),
        at: num(o.at, d.at, -0.5, 1.5),
        size: num(o.size, d.size, 0.01, 3),
        stretch: num(o.stretch, d.stretch, 0.1, 5),
        rotation: num(o.rotation, d.rotation, -360, 360),
        offset: num(o.offset, d.offset, 0, 1),
        fill: hex(o.fill, d.fill),
        outline: hexOrNull(o.outline, d.outline),
        outlineWidth: num(o.outlineWidth, d.outlineWidth, 0, 0.5),
        raised: bool(o.raised, d.raised),
        glow: hexOrNull(o.glow, d.glow),
        accentEvery: Math.round(num(o.accentEvery, d.accentEvery, 0, 100)),
        accentScale: num(o.accentScale, d.accentScale, 0.1, 5),
        accentColor: hexOrNull(o.accentColor, d.accentColor),
        seed: Math.round(num(o.seed, d.seed, 0, 1e9)),
        altColors: Array.isArray(o.altColors) ? o.altColors.filter((c) => typeof c === 'string' && isValidHex(c)).slice(0, 8).map((c) => (c as string).toLowerCase()) : [],
        altSizes: Array.isArray(o.altSizes) ? o.altSizes.slice(0, 8).map((v) => num(v, 1, 0.05, 5)) : [],
        skipAroundAccent: Math.round(num(o.skipAroundAccent, d.skipAroundAccent, 0, 10)),
        alternateSides: num(o.alternateSides, d.alternateSides, 0, 2),
        shaded: bool(o.shaded, d.shaded),
        show: Array.isArray(o.show) && o.show.some((v) => v === true) ? o.show.slice(0, 8).map((v) => v === true) : [],
        follow: idOrNull(o.follow),
        orient: oneOf(o.orient, REPEAT_ORIENTS, d.orient),
        scaleEnd: num(o.scaleEnd, d.scaleEnd, 0.05, 5),
        jitterSize: num(o.jitterSize, d.jitterSize, 0, 1),
        jitterAngle: num(o.jitterAngle, d.jitterAngle, 0, 180),
        skipChance: num(o.skipChance, d.skipChance, 0, 0.95),
        gemCut: oneOf(o.gemCut, GEM_CUTS, d.gemCut),
        gemTable: num(o.gemTable, d.gemTable, 0, 0.95),
        gemCrown: num(o.gemCrown, d.gemCrown, 0.2, 3),
        gemFacets: Math.round(num(o.gemFacets, d.gemFacets, 3, 16)),
        gemSparkle: num(o.gemSparkle, d.gemSparkle, 0, 1),
        setting: oneOf(o.setting, GEM_SETTINGS, d.setting),
        settingColor: hex(o.settingColor, d.settingColor),
        settingEffects: checkEffects(o.settingEffects, common.name, warnings),
        detail: hexOrNull(o.detail, d.detail),
        multipleOf: Math.round(num(o.multipleOf, d.multipleOf, 1, 24)),
        wander: num(o.wander, d.wander, 0, 2),
        fillPaint: checkFillPaint(o.fillPaint),
        paintEach: bool(o.paintEach, d.paintEach),
      };
    }
  }
}

/**
 * The text of a project file. Unsupported layers are written back as they
 * came. `preview` (a PNG data URL) is written after the layers for other apps
 * to show (Token Maker's frame tiles); reading a file ignores it.
 */
export function serializeProject(project: FrameProject, extra: { preview?: string } = {}): string {
  const write = (l: Layer): unknown => {
    if (l.type === 'group') return { ...l, children: l.children.map(write) };
    if (l.type !== 'unsupported') return l;
    // Its clip setting (and any effects) stay in `data` exactly as the file had them.
    const { originalType, data, reason: _r, type: _t, clip: _c, effects: _e, mask: _m, heightMode: _h, heightDepth: _d, heightSize: _s, ...common } = l;
    return { ...data, ...common, type: originalType };
  };
  return JSON.stringify({ ...project, layers: project.layers.map(write), ...extra }, null, 2) + '\n';
}
