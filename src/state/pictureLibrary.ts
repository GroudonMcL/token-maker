// Pictures for picture effects and picture decorations (v8): built-in ones
// are fetched from the site when first used; uploaded ones are kept in
// IndexedDB (their own database, so "New token" never deletes them). Either
// way the picture goes into the asset store under pictureAssetId(), which is
// all the renderer reads.

import { createStore as createIdbStore, del, entries, get, set, type UseStore } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { PictureSource, TokenDocument } from '../document/types';
import { onPictureLoaded } from '../frameStudio/render/pictures';
import { loadFrameDesignPictures } from '../frameStudio/share/frameDesign';
import { decodeImage } from '../import/decode';
import { pictureAssetId, pictureUrl } from '../render/pictureLibrary';
import type { RenderSource } from '../render/render';
import { addAsset, assetStore } from './assets';
import { newFrameId } from './frameLibrary';
import { docHistory } from './tokenStore';

/** A picture the user uploaded, as kept in IndexedDB. */
export interface UploadedPicture {
  id: string;
  name: string;
  blob: Blob;
  added: number;
}

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === 'undefined') return null;
  idb ??= createIdbStore('token-maker-pictures', 'pictures');
  return idb;
}

/** The uploaded pictures, newest first, with a URL for the pickers. */
export const uploadedPictures = createStore<{ pictures: (Omit<UploadedPicture, 'blob'> & { url: string })[]; loaded: boolean }>(() => ({
  pictures: [],
  loaded: false,
}));
export const useUploadedPictures = () => useStore(uploadedPictures);

/** Reads the uploaded pictures from IndexedDB into `uploadedPictures`. */
export async function refreshUploadedPictures(): Promise<void> {
  const db = store();
  if (!db) {
    uploadedPictures.setState({ loaded: true });
    return;
  }
  const all = (await entries<string, UploadedPicture>(db)).map(([, p]) => p).filter((p) => p && p.blob);
  all.sort((a, b) => b.added - a.added);
  for (const p of uploadedPictures.getState().pictures) URL.revokeObjectURL(p.url);
  uploadedPictures.setState({ loaded: true, pictures: all.map(({ id, name, added, blob }) => ({ id, name, added, url: URL.createObjectURL(blob) })) });
}

const loading = new Map<string, Promise<RenderSource>>();

/** Loads a picture into the asset store (once) and returns it. */
export function loadPicture(source: PictureSource): Promise<RenderSource> {
  const id = pictureAssetId(source);
  const have = assetStore.getState().assets.get(id);
  if (have) return Promise.resolve(have);
  let p = loading.get(id);
  if (!p) {
    p = (async () => {
      let blob: Blob | undefined;
      if (source.type === 'library') {
        const res = await fetch(pictureUrl(source.id));
        if (!res.ok) throw new Error(`Could not load the ${source.id} picture.`);
        blob = await res.blob();
      } else {
        const db = store();
        blob = db ? (await get<UploadedPicture>(source.id, db))?.blob : undefined;
        if (!blob) throw new Error('That picture is no longer saved in this browser.');
      }
      const asset = { id, blob, ...(await decodeImage(blob)) };
      addAsset(asset);
      return asset;
    })().finally(() => loading.delete(id));
    loading.set(id, p);
  }
  return p;
}

/** Saves an uploaded picture in this browser. Returns its id and the picture. */
export async function saveUploadedPicture(blob: Blob, name: string, id = newFrameId()): Promise<{ id: string; picture: RenderSource }> {
  // Check it really is a picture before keeping it.
  const decoded = await decodeImage(blob);
  addAsset({ id: pictureAssetId({ type: 'upload', id }), blob, ...decoded });
  const db = store();
  if (db) await set(id, { id, name: name.slice(0, 80), blob, added: Date.now() } satisfies UploadedPicture, db);
  await refreshUploadedPictures();
  return { id, picture: decoded };
}

/** True when an uploaded picture with this id is saved here. */
export async function hasUploadedPicture(id: string): Promise<boolean> {
  const db = store();
  return !!db && !!(await get(id, db));
}

/** An uploaded picture's file (for sharing it in a preset). */
export async function uploadedPictureBlob(id: string): Promise<Blob | null> {
  const db = store();
  return (db && (await get<UploadedPicture>(id, db))?.blob) || null;
}

export async function removeUploadedPicture(id: string): Promise<void> {
  const db = store();
  if (db) await del(id, db);
  await refreshUploadedPictures();
}

/** Every picture a document's effects and decorations use. */
export function documentPictures(doc: Pick<TokenDocument, 'effects' | 'decorations'>): PictureSource[] {
  const out: PictureSource[] = [];
  for (const e of doc.effects) if (e.kind === 'picture' && e.image) out.push(e.image);
  for (const d of doc.decorations) if (d.kind === 'picture' && d.image) out.push(d.image);
  return out;
}

/** Makes sure every picture the document uses is loaded, a Frame Studio design's photo textures too. */
export async function ensurePictures(doc: Pick<TokenDocument, 'effects' | 'decorations' | 'frame'>): Promise<void> {
  const design = doc.frame.kind === 'design' ? doc.frame.design : null;
  await Promise.all([
    ...documentPictures(doc).map((src) => loadPicture(src).catch((e) => console.warn(e))),
    design ? loadFrameDesignPictures(design.project).catch((e) => console.warn(e)) : undefined,
  ]);
}

/** Keeps the document's pictures loaded (undo, autosave restore, presets). Returns a stop function. */
export function watchPictures(): () => void {
  void ensurePictures(docHistory.getState().present);
  const stopDoc = docHistory.subscribe((s, prev) => {
    if (s.present.effects !== prev.present.effects || s.present.decorations !== prev.present.decorations || s.present.frame !== prev.present.frame) void ensurePictures(s.present);
  });
  // A Frame Studio design's photo is drawn as its average colour until it arrives; then
  // everything that draws tokens draws again (they redraw when the asset map changes).
  const stopDesigns = onPictureLoaded(() => assetStore.setState((st) => ({ assets: new Map(st.assets) })));
  return () => {
    stopDoc();
    stopDesigns();
  };
}
