// Autosave to IndexedDB (DESIGN.md §4.4): the current document and the
// images it uses survive a refresh or a closed tab. "New" clears it.

import { createStore as createIdbStore, del, get, keys, set, type UseStore } from 'idb-keyval';
import { migrateDocument } from '../document/migrate';
import type { TokenDocument } from '../document/types';
import { decodeImage } from '../import/decode';
import { addAsset, assetStore } from './assets';
import { docHistory, resetDoc } from './tokenStore';

const DOC_KEY = 'current-doc';
const ASSET_PREFIX = 'asset:';
let idb: UseStore | null = null;

function store(): UseStore | null {
  if (typeof indexedDB === 'undefined') return null;
  idb ??= createIdbStore('token-maker', 'autosave');
  return idb;
}

/** The user's own pictures the document uses (the art, and a background picture of their own). */
export function usedAssetIds(doc: TokenDocument): string[] {
  const ids = [doc.art.assetId, doc.background.image?.type === 'asset' ? doc.background.image.assetId : null];
  return [...new Set(ids.filter((id): id is string => !!id && id.startsWith(ASSET_PREFIX)))];
}

/** Saves the document and its pictures (if not saved yet), and removes pictures no longer used. */
export async function saveNow(doc: TokenDocument): Promise<void> {
  const db = store();
  if (!db) return;
  await set(DOC_KEY, doc, db);
  const used = usedAssetIds(doc);
  const saved = (await keys(db)).filter((k): k is string => typeof k === 'string' && k.startsWith(ASSET_PREFIX));
  for (const id of used) {
    if (saved.includes(id)) continue;
    const asset = assetStore.getState().assets.get(id);
    if (asset) await set(id, asset.blob, db);
  }
  await Promise.all(saved.filter((k) => !used.includes(k)).map((k) => del(k, db)));
}

/** Loads the autosaved token, if any. Returns true when something was restored. */
export async function restore(): Promise<boolean> {
  const db = store();
  if (!db) return false;
  try {
    const raw = await get(DOC_KEY, db);
    if (!raw) return false;
    const doc = migrateDocument(raw);
    for (const id of usedAssetIds(doc)) {
      const blob = await get<Blob>(id, db);
      if (blob) addAsset({ id, blob, ...(await decodeImage(blob)) });
    }
    const has = (id: string | null) => !!id && assetStore.getState().assets.has(id);
    if (doc.art.assetId && !has(doc.art.assetId)) doc.art.assetId = null;
    if (doc.background.image?.type === 'asset' && !has(doc.background.image.assetId)) doc.background.image = null;
    resetDoc(doc);
    return true;
  } catch (err) {
    console.warn('Could not restore the autosaved token', err);
    return false;
  }
}

export async function clearAutosave(): Promise<void> {
  const db = store();
  if (!db) return;
  const all = await keys(db);
  await Promise.all(all.map((k) => del(k, db)));
}

/** Starts saving shortly after every change. Returns a function that stops it. */
export function startAutosave(delayMs = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = docHistory.subscribe((state, prev) => {
    if (state.present === prev.present) return;
    clearTimeout(timer);
    timer = setTimeout(() => void saveNow(state.present).catch((e) => console.warn('Autosave failed', e)), delayMs);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
