// Built-in background pictures are fetched when a token first needs them
// and kept in the asset store under "library:<id>". They are never written
// to the autosave: they come back from the site itself.

import type { TokenDocument } from '../document/types';
import { decodeImage } from '../import/decode';
import { libraryImageUrl } from '../render/backgroundLibrary';
import { addAsset, assetStore } from './assets';
import { docHistory } from './tokenStore';

const loading = new Map<string, Promise<void>>();

/** Loads built-in picture `id` into the asset store (once). */
export function loadLibraryImage(id: string): Promise<void> {
  const assetId = `library:${id}`;
  if (assetStore.getState().assets.has(assetId)) return Promise.resolve();
  let p = loading.get(assetId);
  if (!p) {
    p = (async () => {
      const res = await fetch(libraryImageUrl(id));
      if (!res.ok) throw new Error(`Could not load the ${id} background.`);
      const blob = await res.blob();
      addAsset({ id: assetId, blob, ...(await decodeImage(blob)) });
    })().finally(() => loading.delete(assetId));
    loading.set(assetId, p);
  }
  return p;
}

/** Makes sure every built-in picture the document uses is loaded. */
export async function ensureLibraryImages(doc: TokenDocument): Promise<void> {
  const img = doc.background.image;
  if (img?.type === 'library') await loadLibraryImage(img.id).catch((e) => console.warn(e));
}

/** Keeps built-in pictures loaded as the document changes (undo, autosave restore, New). Returns a stop function. */
export function watchLibraryImages(): () => void {
  void ensureLibraryImages(docHistory.getState().present);
  return docHistory.subscribe((s, prev) => {
    if (s.present.background !== prev.present.background) void ensureLibraryImages(s.present);
  });
}
