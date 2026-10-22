// "Your presets" (DESIGN.md §6.9), kept in this browser's IndexedDB in a
// database of their own, so "New token" never deletes them. Sharing adds the
// pictures of any uploaded frame the look uses, so the preset works in
// another browser; importing saves those pictures here.

import { createStore as createIdbStore, del, entries, set, type UseStore } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { hasUploadedFrame, saveUploadedFrame, uploadedFrameBlob } from '../state/frameLibrary';
import { migratePreset, PresetError, type TokenPreset } from './preset';

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
  const { images, ...preset } = p;
  void images;
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

/** The preset ready to share: with the picture of any uploaded frame it uses. */
export async function withSharedImages(p: TokenPreset): Promise<TokenPreset> {
  const src = p.look.frame.image?.source;
  if (src?.type !== 'upload') return p;
  const blob = await uploadedFrameBlob(src.id);
  return blob ? { ...p, images: { ...p.images, [src.id]: await blobToDataUrl(blob) } } : p;
}

/** Saves any frame pictures a shared preset brings that this browser doesn't have yet. */
export async function installSharedImages(p: TokenPreset): Promise<void> {
  const img = p.look.frame.image;
  if (img?.source.type !== 'upload') return;
  const url = p.images?.[img.source.id];
  if (!url || (await hasUploadedFrame(img.source.id))) return;
  const blob = await (await fetch(url)).blob();
  await saveUploadedFrame(blob, img.name, img.source.id);
}
