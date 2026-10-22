// Loading label fonts (DESIGN.md §6.10) with the FontFace API. Bundled fonts
// come from the site itself (src/fonts/fontFiles.ts) and load the first time
// a label or the font picker needs them. Fonts the user uploads (.ttf, .otf,
// .woff, .woff2) are kept in IndexedDB, in a database of their own so "New
// token" never deletes them. The export waits for the label's font, so it is
// never drawn with a fallback font.

import { createStore as createIdbStore, del, entries, get, set, type UseStore } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { TokenDocument } from '../document/types';
import { clearLabelMeasurements } from '../render/label';
import { docHistory } from '../state/tokenStore';
import { FONTS, fontInfo, isUploadedFont, UPLOAD_PREFIX, uploadedFontFamily } from './catalog';
import { FONT_FILES } from './fontFiles';

/** A font the user uploaded, as kept in IndexedDB. */
export interface UploadedFont {
  id: string;
  name: string;
  blob: Blob;
  added: number;
}

/** Biggest font file accepted. */
export const MAX_FONT_BYTES = 10 * 1024 * 1024;
export const FONT_ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

/**
 * `version` goes up whenever a font finishes loading, so the preview redraws
 * with it. `uploads` lists the user's own fonts, newest first.
 */
export const fontStore = createStore<{ version: number; uploads: Omit<UploadedFont, 'blob'>[]; loaded: boolean }>(() => ({
  version: 0,
  uploads: [],
  loaded: false,
}));
export const useFontVersion = () => useStore(fontStore, (s) => s.version);
export const useUploadedFonts = () => useStore(fontStore);

const canLoadFonts = () => typeof FontFace !== 'undefined' && typeof document !== 'undefined' && !!document.fonts;
const bump = () => {
  clearLabelMeasurements(); // letters measured with the stand-in font are wrong now
  fontStore.setState((s) => ({ version: s.version + 1 }));
};

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === 'undefined') return null;
  idb ??= createIdbStore('token-maker-fonts', 'fonts');
  return idb;
}

const faces = new Map<string, Promise<void>>();

/** Loads one face of a bundled font (once). */
function loadBundledFace(id: string, weight: 400 | 700, style: 'normal' | 'italic'): Promise<void> {
  const info = fontInfo(id);
  const file = FONT_FILES[id]?.find((f) => f.weight === weight && f.style === style);
  if (!info || !file || !canLoadFonts()) return Promise.resolve();
  const key = `${info.family}|${weight}|${style}`;
  let p = faces.get(key);
  if (!p) {
    const face = new FontFace(info.family, `url(${file.url}) format('woff2')`, { weight: String(weight), style });
    p = face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
        bump();
      },
      (e) => {
        faces.delete(key); // try again next time
        throw e;
      },
    );
    faces.set(key, p);
  }
  return p;
}

/**
 * Loads what a label needs to draw `id` in bold and/or italic: the real bold
 * or italic face where the font has one, else the regular face (the browser
 * then thickens or slants it).
 */
export async function loadFont(id: string, bold = false, italic = false): Promise<void> {
  if (isUploadedFont(id)) return loadUploadedFont(id.slice(UPLOAD_PREFIX.length));
  const info = fontInfo(id);
  if (!info) return;
  const weight = bold && info.bold ? 700 : 400;
  const style = italic && info.italic ? 'italic' : 'normal';
  await loadBundledFace(id, weight, style);
}

/** The regular face of every bundled font, so the picker can show each name in its own font. */
export function loadPickerFonts(): Promise<void> {
  return Promise.all(FONTS.map((f) => loadBundledFace(f.id, 400, 'normal').catch((e) => console.warn(e)))).then(() => undefined);
}

// ---- The user's own fonts ----

/** Reads the uploaded fonts' names into `fontStore`. */
export async function refreshUploadedFonts(): Promise<void> {
  const db = store();
  if (!db) {
    fontStore.setState({ loaded: true });
    return;
  }
  const all = (await entries<string, UploadedFont>(db)).map(([, f]) => f).filter((f) => f && f.blob);
  all.sort((a, b) => b.added - a.added);
  fontStore.setState({ loaded: true, uploads: all.map(({ id, name, added }) => ({ id, name, added })) });
}

const uploads = new Map<string, Promise<void>>();

/** Registers an uploaded font's file under its own family name. Throws when the file isn't a font the browser can use. */
async function registerUpload(id: string, blob: Blob): Promise<void> {
  if (!canLoadFonts()) return;
  const face = new FontFace(uploadedFontFamily(id), await blob.arrayBuffer());
  try {
    await face.load();
  } catch {
    throw new Error("That file couldn't be used as a font. Try a .ttf, .otf, .woff or .woff2 file.");
  }
  document.fonts.add(face);
  bump();
}

/** Loads one of the user's fonts from IndexedDB (once). */
export function loadUploadedFont(id: string): Promise<void> {
  let p = uploads.get(id);
  if (!p) {
    p = (async () => {
      const db = store();
      const saved = db ? await get<UploadedFont>(id, db) : undefined;
      if (!saved?.blob) throw new Error('That font is no longer saved in this browser.');
      await registerUpload(id, saved.blob);
    })();
    p.catch(() => uploads.delete(id));
    uploads.set(id, p);
  }
  return p;
}

/** A tidy font name from a file name: "my_cool-Font.ttf" → "my cool Font". */
export function fontNameFromFile(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'My font';
}

/** Saves a font file in this browser and returns its id for the label ("upload:<id>"). */
export async function saveUploadedFont(blob: Blob, name: string, id = newFontId()): Promise<string> {
  if (blob.size > MAX_FONT_BYTES) throw new Error('That font file is too big (the limit is 10 MB).');
  await registerUpload(id, blob); // checks it really is a font
  uploads.set(id, Promise.resolve());
  const db = store();
  if (db) await set(id, { id, name: name.slice(0, 60), blob, added: Date.now() } satisfies UploadedFont, db);
  await refreshUploadedFonts();
  return `${UPLOAD_PREFIX}${id}`;
}

export async function hasUploadedFont(id: string): Promise<boolean> {
  const db = store();
  return !!db && !!(await get(id, db));
}

/** An uploaded font's name and file (for sharing it in a preset). */
export async function uploadedFont(id: string): Promise<UploadedFont | null> {
  const db = store();
  const f = db ? await get<UploadedFont>(id, db) : undefined;
  return f?.blob ? f : null;
}

export async function removeUploadedFont(id: string): Promise<void> {
  const db = store();
  if (db) await del(id, db);
  await refreshUploadedFonts();
}

function newFontId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

// ---- Keeping the label's font loaded ----

/** Loads the label's font; resolves when it is ready (the export waits for this). */
export async function ensureLabelFont(doc: Pick<TokenDocument, 'label'>): Promise<void> {
  const l = doc.label;
  if (!l) return;
  await loadFont(l.font, l.bold, l.italic).catch((e) => console.warn(e));
  if (canLoadFonts()) await document.fonts.ready;
}

/** Keeps the label's font loaded as the document changes (undo, autosave restore, presets). Returns a stop function. */
export function watchLabelFonts(): () => void {
  void ensureLabelFont(docHistory.getState().present);
  return docHistory.subscribe((s, prev) => {
    if (s.present.label !== prev.present.label) void ensureLabelFont(s.present);
  });
}
