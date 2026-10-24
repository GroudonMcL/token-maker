// Reading saved projects (files, autosave, the data view). Old versions are
// migrated one step at a time, then every field is checked: a bad value falls
// back to its default with a warning, and a layer this version can't read is
// kept as an "unsupported" layer rather than silently dropped.

import { FRAME_STYLES, SHAPES } from '../../render/catalog';
import { isValidHex } from '../../render/color';
import { DEFAULT_STAGE, NEW_LAYER, newId, textureLayer } from './defaults';
import {
  BLEND_MODES,
  CLIP_MODES,
  DEFAULT_LIGHT,
  ELEMENT_KINDS,
  MIRROR_MODES,
  PROJECT_FORMAT,
  SCHEMA_VERSION,
  SHAPE_KINDS,
  TEXTURE_KINDS,
  TEXTURE_PLACES,
  type FrameProject,
  type GradientStop,
  type Layer,
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
  };
}

function checkStyle(o: Obj, d: PlacedStyle): PlacedStyle {
  return {
    fill: hexOrNull(o.fill, d.fill),
    shaded: bool(o.shaded, d.shaded),
    outline: hexOrNull(o.outline, d.outline),
    outlineWidth: num(o.outlineWidth, d.outlineWidth, 0, 0.5),
    raised: bool(o.raised, d.raised),
    glow: hexOrNull(o.glow, d.glow),
  };
}

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
  };
  if (!(type in NEW_LAYER) || (type === 'group' && depth >= MAX_DEPTH)) {
    warnings.push(`Layer "${common.name}" is a kind this version can't draw (${type}); it is kept but hidden from the picture.`);
    const { id: _id, name: _n, visible: _v, locked: _l, opacity: _o, blend: _b, ...data } = o;
    return { ...common, type: 'unsupported', originalType: type, data, reason: `Unknown layer kind "${type}".` };
  }
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
        dash: oneOf(o.dash, ['solid', 'dashed', 'dotted'] as const, 'solid'),
        glow: hexOrNull(o.glow, null),
        waveAmplitude: num(o.waveAmplitude, d.waveAmplitude, 0, 2),
        waves: Math.round(num(o.waves, d.waves, 1, 200)),
        wavePhase: num(o.wavePhase, d.wavePhase, 0, 1),
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
      };
    }
    case 'path': {
      const d = NEW_LAYER.path();
      if (d.type !== 'path') throw new Error('unreachable');
      return { ...common, type, ...checkPlacement(o, d), ...checkStyle(o, d), points: checkPoints(o.points), closed: bool(o.closed, d.closed) };
    }
    case 'group':
      return { ...common, type, children: checkLayers(o.children, warnings, ids, depth + 1), collapsed: bool(o.collapsed, false) };
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
    // Its clip setting stays in `data` exactly as the file had it.
    const { originalType, data, reason: _r, type: _t, clip: _c, ...common } = l;
    return { ...data, ...common, type: originalType };
  };
  return JSON.stringify({ ...project, layers: project.layers.map(write), ...extra }, null, 2) + '\n';
}
