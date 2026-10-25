// Layers on their way somewhere else: copied to the clipboard, saved in the
// personal library, or written to a library file (DESIGN.md §4.8). Each is a
// small project-like object, so it is read by parseProject with the same
// checks and migrations as a project file, and a newer Frame Studio's layers
// are kept rather than dropped.

import { checkEffects, parseProject, serializeProject } from './migrate';
import { PROJECT_FORMAT, SCHEMA_VERSION, type Effect, type FrameProject, type Layer, type StageSettings } from './types';

export const PROJECT_EXTENSION = '.framestudio.json';
export const LIBRARY_EXTENSION = '.framestudio-library.json';
/** Layers copied or saved: their own name, the layers (bottom first) and the stage they were made on. */
export const LAYERS_FORMAT = 'frame-studio-layers';
/** A library file: several saved items. */
export const LIBRARY_FORMAT = 'frame-studio-library';

export interface LayerSet {
  name: string;
  /** Bottom first. */
  layers: Layer[];
  /** The stage they were made on (their thumbnail is drawn on it). */
  stage: StageSettings;
}

export type LayerSetResult = { ok: true; set: LayerSet; warnings: string[] } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function asObj(input: unknown): Obj | null {
  if (typeof input !== 'string') return isObj(input) ? input : null;
  try {
    const v: unknown = JSON.parse(input);
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}

/** The text for copied or saved layers. */
export function serializeLayers(set: LayerSet): string {
  const text = serializeProject({ format: PROJECT_FORMAT, schemaVersion: SCHEMA_VERSION, name: set.name, stage: set.stage, layers: set.layers });
  return JSON.stringify({ ...JSON.parse(text), format: LAYERS_FORMAT });
}

/** Reads copied or saved layers. A whole project file is read as its layers. */
export function parseLayers(input: unknown): LayerSetResult {
  const raw = asObj(input);
  if (!raw || (raw.format !== LAYERS_FORMAT && raw.format !== PROJECT_FORMAT)) return { ok: false, error: "These aren't Frame Studio layers." };
  const result = parseProject({ ...raw, format: PROJECT_FORMAT });
  if (!result.ok) return { ok: false, error: result.error.replace('project file', 'layers') };
  if (result.project.layers.length === 0) return { ok: false, error: 'There are no layers in it.' };
  const { name, layers, stage } = result.project;
  return { ok: true, set: { name, layers, stage }, warnings: result.warnings };
}

/** A style of your own (version 9): a named stack of effects. */
export interface SavedStyle {
  name: string;
  effects: Effect[];
}

/** The text of a library file holding these items (and, since version 9, your own styles). */
export function serializeLibrary(sets: LayerSet[], styles: SavedStyle[] = []): string {
  const items = sets.map((s) => JSON.parse(serializeLayers(s)) as unknown);
  return JSON.stringify({ format: LIBRARY_FORMAT, schemaVersion: SCHEMA_VERSION, items, ...(styles.length ? { styles: styles.map(({ name, effects }) => ({ name, effects })) } : {}) }, null, 2) + '\n';
}

/**
 * Reads a library file into its items. A file of copied layers or a project
 * file is read as one item (a project's layers, named after it). Items that
 * can't be read are left out, with a warning each.
 */
export function parseLibrary(input: unknown): { ok: true; sets: LayerSet[]; styles: SavedStyle[]; warnings: string[] } | { ok: false; error: string } {
  const raw = asObj(input);
  if (!raw) return { ok: false, error: "This isn't a Frame Studio library file (it isn't valid JSON)." };
  if (raw.format === LAYERS_FORMAT || raw.format === PROJECT_FORMAT) {
    const one = parseLayers(raw);
    return one.ok ? { ok: true, sets: [one.set], styles: [], warnings: one.warnings } : one;
  }
  if (raw.format !== LIBRARY_FORMAT || !Array.isArray(raw.items ?? [])) return { ok: false, error: "This isn't a Frame Studio library file." };
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `This library was made with a newer Frame Studio (format ${raw.schemaVersion}); this one reads up to ${SCHEMA_VERSION}.` };
  }
  const sets: LayerSet[] = [];
  const warnings: string[] = [];
  ((raw.items as unknown[] | undefined) ?? []).forEach((item, i) => {
    const one = parseLayers(isObj(item) ? { schemaVersion: raw.schemaVersion, ...item } : item);
    if (one.ok) {
      sets.push(one.set);
      warnings.push(...one.warnings);
    } else warnings.push(`Item ${i + 1} couldn't be read: ${one.error}`);
  });
  const styles: SavedStyle[] = Array.isArray(raw.styles)
    ? raw.styles.filter(isObj).flatMap((st) => {
        const name = typeof st.name === 'string' && st.name.trim() ? st.name.trim().slice(0, 60) : 'Style';
        const effects = checkEffects(st.effects, name, warnings);
        return effects.length ? [{ name, effects }] : [];
      })
    : [];
  if (sets.length === 0 && styles.length === 0) return { ok: false, error: 'There is nothing in this library file that can be read.' };
  return { ok: true, sets, styles, warnings };
}

/** A project holding a set's layers on its stage (for thumbnails). */
export function projectOf(set: LayerSet): FrameProject {
  return { format: PROJECT_FORMAT, schemaVersion: SCHEMA_VERSION, name: set.name, stage: set.stage, layers: set.layers };
}
