// Picture frames (DESIGN.md §6.9): built-in ones are fetched from the site
// when first used; uploaded ones are kept in IndexedDB (their own database,
// so "New token" never deletes them). Either way the picture goes into the
// asset store under frameAssetId(), and the hole is found once per picture.

import { createStore as createIdbStore, del, entries, get, set, type UseStore } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ImageFrame, ImageFrameSource, TokenDocument } from '../document/types';
import type { PixelBuffer } from '../image/adjust';
import { findFrameHole, type FrameHole } from '../image/frameHole';
import { newCanvas } from '../image/processedArt';
import { decodeImage } from '../import/decode';
import { FRAME_LIBRARY, frameAssetId, frameImageUrl } from '../render/imageFrames';
import type { RenderSource } from '../render/render';
import { addAsset, assetStore } from './assets';
import { docHistory } from './tokenStore';

/** A frame the user uploaded, as kept in IndexedDB. */
export interface UploadedFrame {
  id: string;
  name: string;
  blob: Blob;
  added: number;
}

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === 'undefined') return null;
  idb ??= createIdbStore('token-maker-frames', 'frames');
  return idb;
}

/** The uploaded frames, newest first, with a picture URL for the picker. */
export const uploadedFrames = createStore<{ frames: (Omit<UploadedFrame, 'blob'> & { url: string })[]; loaded: boolean }>(() => ({ frames: [], loaded: false }));
export const useUploadedFrames = () => useStore(uploadedFrames);

/** Reads the uploaded frames from IndexedDB into `uploadedFrames`. */
export async function refreshUploadedFrames(): Promise<void> {
  const db = store();
  if (!db) {
    uploadedFrames.setState({ loaded: true });
    return;
  }
  const all = (await entries<string, UploadedFrame>(db)).map(([, f]) => f).filter((f) => f && f.blob);
  all.sort((a, b) => b.added - a.added);
  for (const f of uploadedFrames.getState().frames) URL.revokeObjectURL(f.url);
  uploadedFrames.setState({ loaded: true, frames: all.map(({ id, name, added, blob }) => ({ id, name, added, url: URL.createObjectURL(blob) })) });
}

const loading = new Map<string, Promise<RenderSource>>();

/** Loads a frame's picture into the asset store (once) and returns it. */
export function loadFrameImage(source: ImageFrameSource): Promise<RenderSource> {
  const id = frameAssetId(source);
  const have = assetStore.getState().assets.get(id);
  if (have) return Promise.resolve(have);
  let p = loading.get(id);
  if (!p) {
    p = (async () => {
      let blob: Blob | undefined;
      if (source.type === 'library') {
        const res = await fetch(frameImageUrl(source.id));
        if (!res.ok) throw new Error(`Could not load the ${source.id} frame.`);
        blob = await res.blob();
      } else {
        const db = store();
        blob = db ? (await get<UploadedFrame>(source.id, db))?.blob : undefined;
        if (!blob) throw new Error('That frame is no longer saved in this browser.');
      }
      const asset = { id, blob, ...(await decodeImage(blob)) };
      addAsset(asset);
      return asset;
    })().finally(() => loading.delete(id));
    loading.set(id, p);
  }
  return p;
}

/** A copy of a picture's pixels no bigger than `max` px, for finding the hole. */
export function framePixels(src: RenderSource, max = 512): PixelBuffer {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const c = newCanvas(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(src.image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return { data: data.data, width: w, height: h };
}

const holes = new Map<string, FrameHole>();

/** Loads a frame and finds its hole: the `image` settings for the document. */
export async function prepareImageFrame(source: ImageFrameSource, name: string): Promise<ImageFrame & { found: boolean; open: boolean }> {
  const img = await loadFrameImage(source);
  const key = frameAssetId(source);
  let hole = holes.get(key);
  if (!hole) {
    hole = findFrameHole(framePixels(img));
    holes.set(key, hole);
  }
  return { source, name, hole: hole.hole, outer: hole.outer, nudge: { x: 0, y: 0, scale: 1 }, found: hole.found, open: hole.open };
}

/** Saves an uploaded frame picture in this browser. Returns its id. */
export async function saveUploadedFrame(blob: Blob, name: string, id = newFrameId()): Promise<string> {
  // Check it really is a picture before keeping it.
  const decoded = await decodeImage(blob);
  addAsset({ id: frameAssetId({ type: 'upload', id }), blob, ...decoded });
  const db = store();
  if (db) await set(id, { id, name: name.slice(0, 80), blob, added: Date.now() } satisfies UploadedFrame, db);
  await refreshUploadedFrames();
  return id;
}

/** True when an uploaded frame with this id is saved here. */
export async function hasUploadedFrame(id: string): Promise<boolean> {
  const db = store();
  return !!db && !!(await get(id, db));
}

/** The picture of an uploaded frame (for sharing it in a preset). */
export async function uploadedFrameBlob(id: string): Promise<Blob | null> {
  const db = store();
  return (db && (await get<UploadedFrame>(id, db))?.blob) || null;
}

export async function removeUploadedFrame(id: string): Promise<void> {
  const db = store();
  if (db) await del(id, db);
  await refreshUploadedFrames();
}

export function newFrameId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export const libraryFrameName = (id: string) => FRAME_LIBRARY.find((f) => f.id === id)?.name ?? 'Picture frame';

/** Keeps the document's frame picture loaded (undo, autosave restore, presets). Returns a stop function. */
export function watchFrameImages(): () => void {
  const ensure = (doc: TokenDocument) => {
    const img = doc.frame.image;
    if (img) void loadFrameImage(img.source).catch((e) => console.warn(e));
  };
  ensure(docHistory.getState().present);
  return docHistory.subscribe((s, prev) => {
    if (s.present.frame.image !== prev.present.frame.image) ensure(s.present);
  });
}
