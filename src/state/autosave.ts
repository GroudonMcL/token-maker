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

/** Saves the document and its image (if not saved yet), and removes images no longer used. */
export async function saveNow(doc: TokenDocument): Promise<void> {
  const db = store();
  if (!db) return;
  await set(DOC_KEY, doc, db);
  const used = doc.art.assetId;
  const saved = (await keys(db)).filter((k): k is string => typeof k === 'string' && k.startsWith(ASSET_PREFIX));
  if (used && !saved.includes(used)) {
    const asset = assetStore.getState().assets.get(used);
    if (asset) await set(used, asset.blob, db);
  }
  await Promise.all(saved.filter((k) => k !== used).map((k) => del(k, db)));
}

/** Loads the autosaved token, if any. Returns true when something was restored. */
export async function restore(): Promise<boolean> {
  const db = store();
  if (!db) return false;
  try {
    const raw = await get(DOC_KEY, db);
    if (!raw) return false;
    const doc = migrateDocument(raw);
    if (doc.art.assetId) {
      const blob = await get<Blob>(doc.art.assetId, db);
      if (blob) {
        const image = await decodeImage(blob);
        addAsset({ id: doc.art.assetId, blob, ...image });
      } else {
        doc.art.assetId = null;
      }
    }
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
