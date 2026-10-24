// "Your presets" (DESIGN.md §6.9), kept in this browser's IndexedDB in a
// database of their own, so "New token" never deletes them. Sharing adds the
// pictures of any uploaded frame the look uses, so the preset works in
// another browser; importing saves those pictures here. Uploaded label fonts
// and the user's own pictures in picture effects and decorations (v8) travel
// the same way.

import { createStore as createIdbStore, del, entries, set, type UseStore } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { UPLOAD_PREFIX } from '../fonts/catalog';
import { hasUploadedFont, saveUploadedFont, uploadedFont } from '../fonts/fontLoader';
import { hasUploadedFrame, saveUploadedFrame, uploadedFrameBlob } from '../state/frameLibrary';
import { documentPictures, hasUploadedPicture, saveUploadedPicture, uploadedPictureBlob } from '../state/pictureLibrary';
import { migratePreset, PresetError, type TokenPreset } from './preset';
import { hasDesign, saveDesign } from '../state/designLibrary';

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === 'undefined') return null;
  idb ??= createIdbStore('token-maker-presets', 'presets');
  return idb;
}

interface Saved {
  preset: TokenPreset;
  saved: number;
}

export const savedPresets = createStore<{ presets: TokenPreset[]; loaded: boolean }>(() => ({ presets: [], loaded: false }));
export const useSavedPresets = () => useStore(savedPresets);

/** Reads your presets from IndexedDB, newest first. Damaged entries are skipped. */
export async function refreshSavedPresets(): Promise<void> {
  const db = store();
  if (!db) {
    savedPresets.setState({ loaded: true });
    return;
  }
  const list: { preset: TokenPreset; saved: number }[] = [];
  for (const [, v] of await entries<string, Saved>(db)) {
    try {
      list.push({ preset: migratePreset(v?.preset), saved: v?.saved ?? 0 });
    } catch (e) {
      console.warn('Skipped a damaged preset', e);
    }
  }
  list.sort((a, b) => b.saved - a.saved);
  savedPresets.setState({ loaded: true, presets: list.map((x) => x.preset) });
}

/** Saves (or replaces) a preset in this browser. Pictures in it are saved as uploaded frames, not with the preset. */
export async function savePreset(p: TokenPreset): Promise<void> {
  const { images, fonts, ...preset } = p;
  void images;
  void fonts;
  const db = store();
  if (!db) throw new PresetError("This browser can't save presets (private browsing may block it).");
  await set(preset.id, { preset, saved: Date.now() } satisfies Saved, db);
  await refreshSavedPresets();
}

export async function deletePreset(id: string): Promise<void> {
  const db = store();
  if (db) await del(id, db);
  await refreshSavedPresets();
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** The uploaded font a look's label uses, if any. */
const labelUpload = (p: TokenPreset) => {
  const font = p.look.label?.font;
  return font?.startsWith(UPLOAD_PREFIX) ? font.slice(UPLOAD_PREFIX.length) : null;
};

/** The preset ready to share: with the picture of any uploaded frame and any uploaded label font it uses. */
export async function withSharedImages(p: TokenPreset): Promise<TokenPreset> {
  let out = p;
  const src = p.look.frame.image?.source;
  if (src?.type === 'upload') {
    const blob = await uploadedFrameBlob(src.id);
    if (blob) out = { ...out, images: { ...out.images, [src.id]: await blobToDataUrl(blob) } };
  }
  for (const pic of uploadedPictureIds(p)) {
    const blob = await uploadedPictureBlob(pic);
    if (blob) out = { ...out, images: { ...out.images, [pic]: await blobToDataUrl(blob) } };
  }
  const fontId = labelUpload(p);
  if (fontId) {
    const font = await uploadedFont(fontId);
    if (font) out = { ...out, fonts: { ...out.fonts, [fontId]: { name: font.name, data: await blobToDataUrl(font.blob) } } };
  }
  return out;
}

/** The ids of the user's own pictures a look's effects and decorations use. */
const uploadedPictureIds = (p: TokenPreset) => [...new Set(documentPictures(p.look).filter((s) => s.type === 'upload').map((s) => s.id))];

/** Saves any frame pictures, effect and decoration pictures and label fonts a shared preset brings that this browser doesn't have yet. */
export async function installSharedImages(p: TokenPreset): Promise<void> {
  for (const pic of uploadedPictureIds(p)) {
    const url = p.images?.[pic];
    if (!url || (await hasUploadedPicture(pic))) continue;
    const blob = await (await fetch(url)).blob();
    await saveUploadedPicture(blob, 'Shared picture', pic).catch((e) => console.warn(e));
  }
  const fontId = labelUpload(p);
  const font = fontId ? p.fonts?.[fontId] : undefined;
  if (fontId && font && !(await hasUploadedFont(fontId))) {
    const blob = await (await fetch(font.data)).blob();
    await saveUploadedFont(blob, font.name, fontId).catch((e) => console.warn(e));
  }
  // A Frame Studio design travels inside the look; keep it in this browser's design library too, to pick again.
  const design = p.look.frame.design;
  if (design && !(await hasDesign(design.id))) await saveDesign(JSON.stringify(design.project), design.name, design.id).catch((e) => console.warn(e));
  const img = p.look.frame.image;
  if (img?.source.type !== 'upload') return;
  const url = p.images?.[img.source.id];
  if (!url || (await hasUploadedFrame(img.source.id))) return;
  const blob = await (await fetch(url)).blob();
  await saveUploadedFrame(blob, img.name, img.source.id);
}
