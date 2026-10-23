// Presets (DESIGN.md §6.9): a token's look — shape, frame, background,
// lighting, effects (overlays included), decorations, shadows and label style — saved
// to reuse or share. A preset never holds the user's art (nor a background
// picture of their own). Shared presets travel as a `.tokenpreset.json` file
// or as a text code that can be copied and pasted.
//
// Two version numbers keep old presets loading: `schemaVersion` is the
// preset format itself (PRESET_MIGRATIONS), and `docVersion` is the
// TokenDocument version the look was saved from, so the look goes through
// the same migrations as a saved token (src/document/migrate.ts).

import { createDocument } from '../document/defaults';
import { migrateDocument } from '../document/migrate';
import { SCHEMA_VERSION, type TokenDocument } from '../document/types';

export const PRESET_SCHEMA_VERSION = 1;
export const PRESET_FILE_EXT = '.tokenpreset.json';
/** Text codes start with this, then the format: 1 = compressed, 0 = plain. */
export const CODE_PREFIX = 'TKP';

/** The parts of a token a preset carries. */
export const LOOK_KEYS = ['shape', 'background', 'lighting', 'effects', 'frame', 'decorations', 'shadows', 'label'] as const;
export type PresetLook = Pick<TokenDocument, (typeof LOOK_KEYS)[number]>;

export interface TokenPreset {
  /** The preset format's version. */
  schemaVersion: number;
  /** The TokenDocument version the look was saved from. */
  docVersion: number;
  id: string;
  name: string;
  look: PresetLook;
  /**
   * Pictures of uploaded frames the look uses, as `data:` URLs keyed by the
   * frame's id. Only in shared files and codes, so they load in another browser.
   */
  images?: Record<string, string>;
  /** Uploaded label fonts the look uses, with their file as a `data:` URL, keyed by the font's id (shared files and codes only). */
  fonts?: Record<string, { name: string; data: string }>;
}

export class PresetError extends Error {}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Migrations of the preset format: `PRESET_MIGRATIONS[n]` turns a version-n
 * preset into version n+1. Version 0 is a bare look with a name (the shape
 * used while presets were being designed), kept as the first example.
 */
export const PRESET_MIGRATIONS: Record<number, (p: Json) => Json> = {
  0: (p) => (isObject(p.look) ? p : { name: p.name, id: p.id, docVersion: p.docVersion ?? p.schemaVersion ?? 5, look: p }),
};

export function newPresetId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `preset:${rnd}`;
}

/** The look of a token, without anything that belongs to its own picture. */
export function lookFromDoc(doc: TokenDocument): PresetLook {
  const copy = JSON.parse(JSON.stringify(Object.fromEntries(LOOK_KEYS.map((k) => [k, doc[k]])))) as PresetLook;
  // A background picture of the user's own is theirs, like the art.
  if (copy.background.image?.type === 'asset') {
    copy.background.image = null;
    if (copy.background.kind === 'image') copy.background.kind = 'none';
  }
  // A label's style is part of the look; its words belong to the token.
  if (copy.label) copy.label.text = null;
  return copy;
}

/** Saves the token's look as a new preset. */
export function createPreset(doc: TokenDocument, name: string, id = newPresetId()): TokenPreset {
  return { schemaVersion: PRESET_SCHEMA_VERSION, docVersion: SCHEMA_VERSION, id, name: tidyName(name), look: lookFromDoc(doc) };
}

const tidyName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 60) || 'My preset';

/**
 * The document with a preset's look applied. The art, its edits, the name
 * and the size stay as they are; a label keeps its own text.
 */
export function applyLook(doc: TokenDocument, look: PresetLook): TokenDocument {
  const copy = JSON.parse(JSON.stringify(look)) as PresetLook;
  const label = copy.label ? { ...copy.label, text: doc.label?.text ?? null } : null;
  // Keep the user's own background picture when the preset has no picture of its own.
  const background =
    doc.background.image?.type === 'asset' && copy.background.kind !== 'image' && copy.background.image === null
      ? { ...copy.background, image: doc.background.image }
      : copy.background;
  return { ...doc, ...copy, background, label };
}

/**
 * Checks a preset from a file, a code, storage or the built-ins, upgrading
 * old versions. Throws a PresetError with a friendly message when it isn't one.
 */
export function migratePreset(raw: unknown): TokenPreset {
  if (!isObject(raw)) throw new PresetError("That isn't a Token Maker preset.");
  let p: Json = raw;
  let version = typeof p.schemaVersion === 'number' && isObject(p.look) ? p.schemaVersion : 0;
  if (version > PRESET_SCHEMA_VERSION) throw new PresetError('This preset was made with a newer version of Token Maker. Reload the page to update.');
  while (version < PRESET_SCHEMA_VERSION) {
    const step = PRESET_MIGRATIONS[version];
    if (!step) throw new PresetError(`No migration for presets of version ${version}.`);
    p = { ...step(p), schemaVersion: version + 1 };
    version++;
  }
  if (!isObject(p.look)) throw new PresetError("That isn't a Token Maker preset.");
  const docVersion = typeof p.docVersion === 'number' ? p.docVersion : SCHEMA_VERSION;
  if (docVersion > SCHEMA_VERSION) throw new PresetError('This preset was made with a newer version of Token Maker. Reload the page to update.');
  // The look goes through the document's own migrations and checks.
  const doc = migrateDocument({ ...p.look, schemaVersion: docVersion });
  const images: Record<string, string> = {};
  if (isObject(p.images)) {
    for (const [id, url] of Object.entries(p.images)) {
      if (typeof url === 'string' && /^data:image\/(png|webp|jpeg|gif|avif);base64,/.test(url) && url.length < 12_000_000) images[id.slice(0, 80)] = url;
    }
  }
  const fonts: Record<string, { name: string; data: string }> = {};
  if (isObject(p.fonts)) {
    for (const [id, f] of Object.entries(p.fonts)) {
      if (!isObject(f)) continue;
      const data = f.data;
      if (typeof data === 'string' && /^data:(font\/[a-z0-9.+-]+|application\/[a-z0-9.+-]+)?;base64,/.test(data) && data.length < 14_000_000) {
        fonts[id.slice(0, 80)] = { name: typeof f.name === 'string' ? f.name.slice(0, 60) : 'Shared font', data };
      }
    }
  }
  return {
    schemaVersion: PRESET_SCHEMA_VERSION,
    docVersion: SCHEMA_VERSION,
    id: typeof p.id === 'string' && p.id ? p.id.slice(0, 120) : newPresetId(),
    name: tidyName(typeof p.name === 'string' ? p.name : ''),
    look: lookFromDoc(doc),
    ...(Object.keys(images).length ? { images } : {}),
    ...(Object.keys(fonts).length ? { fonts } : {}),
  };
}

// ---- Files and text codes ----

/** The preset as the text of a `.tokenpreset.json` file. */
export function presetToJson(p: TokenPreset): string {
  return JSON.stringify(p, null, 2);
}

/** A safe file name for a preset. */
export function presetFileName(p: Pick<TokenPreset, 'name'>): string {
  const base = p.name.replace(/[^a-z0-9 _-]+/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'preset';
  return `${base.slice(0, 50)}${PRESET_FILE_EXT}`;
}

const toBase64Url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (text: string) => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Response(bytes as BodyInit).body!.pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/**
 * The preset as one line of text to copy and paste: "TKP1." and the
 * compressed preset (or "TKP0." and the plain preset where the browser
 * can't compress), in URL-safe base 64.
 */
export async function presetToCode(p: TokenPreset): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p));
  if (!canCompress()) return `${CODE_PREFIX}0.${toBase64Url(json)}`;
  return `${CODE_PREFIX}1.${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

/** Reads a preset from a pasted code or the text of a preset file. */
export async function presetFromText(text: string): Promise<TokenPreset> {
  const t = text.trim();
  if (t.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(t);
    } catch {
      throw new PresetError("That file isn't a Token Maker preset (it couldn't be read).");
    }
    return migratePreset(parsed);
  }
  const m = /^TKP(\d+)\.([A-Za-z0-9_-]+)$/.exec(t.replace(/\s+/g, ''));
  if (!m) throw new PresetError("That doesn't look like a preset code. Codes start with TKP.");
  try {
    let bytes: Uint8Array = fromBase64Url(m[2]!);
    if (m[1] === '1') {
      if (!canCompress()) throw new PresetError("This browser can't open compressed preset codes. Try the preset file instead.");
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (m[1] !== '0') {
      throw new PresetError('This preset code was made with a newer version of Token Maker. Reload the page to update.');
    }
    return migratePreset(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) {
    if (e instanceof PresetError) throw e;
    throw new PresetError("That preset code is damaged. Check it was copied in full.");
  }
}

/** A blank token with the preset applied (for thumbnails and tests). */
export function previewDocument(p: TokenPreset): TokenDocument {
  return applyLook(createDocument(p.name), p.look);
}
