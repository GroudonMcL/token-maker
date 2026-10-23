// AI background removal (owner request after Phase 10). The cut-out mask
// belongs to a picture, not to the document: it is kept here by the art's
// asset id (and in IndexedDB, so a reload doesn't redo it), which means each
// picture in a batch gets its own. The work happens in ai.worker.ts.

import { createStore as createIdbStore, del, get, set, type UseStore } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { TokenDocument } from '../document/types';
import type { RenderSource } from '../render/render';
import { assetStore } from '../state/assets';
import { docHistory } from '../state/tokenStore';
import type { AiRequest, AiResponse } from './ai.worker';
import { setAiMaskLookup, type AiMask } from './process';
import { newCanvas } from './processedArt';

/** Bigger pictures are shrunk to this before going to the model (which looks at 512 × 512); the mask is scaled back up. */
const AI_SIDE = 1024;

export type AiStatus =
  | { state: 'working'; stage: 'download' | 'thinking'; progress: number }
  | { state: 'error'; message: string };

interface AiState {
  masks: ReadonlyMap<string, AiMask>;
  status: ReadonlyMap<string, AiStatus>;
}

export const aiStore = createStore<AiState>(() => ({ masks: new Map(), status: new Map() }));
export const useAiStatus = (assetId: string | null) => useStore(aiStore, (s) => (assetId ? (s.status.get(assetId) ?? null) : null));
export const useHasAiMask = (assetId: string | null) => useStore(aiStore, (s) => !!assetId && s.masks.has(assetId));

setAiMaskLookup((assetId) => aiStore.getState().masks.get(assetId) ?? null);

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === 'undefined') return null;
  idb ??= createIdbStore('token-maker-ai-masks', 'masks');
  return idb;
}

let nextMaskId = 1;
function setMask(assetId: string, mask: Omit<AiMask, 'id'>): void {
  const masks = new Map(aiStore.getState().masks);
  masks.set(assetId, { ...mask, id: nextMaskId++ });
  const status = new Map(aiStore.getState().status);
  status.delete(assetId);
  aiStore.setState({ masks, status });
}

function setStatus(assetId: string, s: AiStatus | null): void {
  const status = new Map(aiStore.getState().status);
  if (s) status.set(assetId, s);
  else status.delete(assetId);
  aiStore.setState({ status });
}

let worker: Worker | null = null;
let nextJob = 1;
const jobs = new Map<number, { assetId: string; resolve: () => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<AiResponse>) => {
    const msg = e.data;
    const job = jobs.get(msg.id);
    if (!job) return;
    if (msg.type === 'progress') {
      setStatus(job.assetId, { state: 'working', stage: msg.stage, progress: msg.progress });
      return;
    }
    jobs.delete(msg.id);
    if (msg.type === 'done') {
      const mask = { data: msg.mask, width: msg.width, height: msg.height };
      setMask(job.assetId, mask);
      const db = store();
      if (db) void set(job.assetId, mask, db).catch((err) => console.warn('Could not keep the AI mask', err));
    } else {
      setStatus(job.assetId, { state: 'error', message: friendly(msg.message) });
    }
    job.resolve();
  };
  worker.onerror = (e) => {
    for (const [, job] of jobs) {
      setStatus(job.assetId, { state: 'error', message: friendly(e.message) });
      job.resolve();
    }
    jobs.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function friendly(message: string): string {
  if (/fetch|network|load/i.test(message)) return "The AI model couldn't be downloaded. Check your connection and try again.";
  if (/memory|allocation/i.test(message)) return 'This device ran out of memory for the AI. Try flat-colour removal instead.';
  return "The AI couldn't cut this picture out. Try again, or use flat-colour removal.";
}

/** The picture's pixels, no bigger than AI_SIDE. */
function picturePixels(src: RenderSource) {
  const k = Math.min(1, AI_SIDE / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * k));
  const h = Math.max(1, Math.round(src.height * k));
  const c = newCanvas(w, h);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.image, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

const running = new Map<string, Promise<void>>();

/** Makes the AI cut-out mask for a picture (again, if it has one). */
export function runAiRemoval(assetId: string, src: RenderSource): Promise<void> {
  let p = running.get(assetId);
  if (p) return p;
  p = new Promise<void>((resolve) => {
    const id = nextJob++;
    jobs.set(id, { assetId, resolve });
    setStatus(assetId, { state: 'working', stage: 'download', progress: 0 });
    try {
      const pixels = picturePixels(src);
      getWorker().postMessage({ type: 'run', id, pixels } satisfies AiRequest, [pixels.data.buffer]);
    } catch (err) {
      jobs.delete(id);
      setStatus(assetId, { state: 'error', message: friendly(err instanceof Error ? err.message : String(err)) });
      resolve();
    }
  }).finally(() => running.delete(assetId));
  running.set(assetId, p);
  return p;
}

/** Brings back a mask made earlier in this browser. True when there was one. */
async function restoreMask(assetId: string): Promise<boolean> {
  const db = store();
  const saved = db ? await get<Omit<AiMask, 'id'>>(assetId, db).catch(() => undefined) : undefined;
  if (!saved?.data || !saved.width || !saved.height) return false;
  setMask(assetId, saved);
  return true;
}

/** Forgets a picture's mask, so the next AI removal makes a new one. */
export async function forgetAiMask(assetId: string): Promise<void> {
  const masks = new Map(aiStore.getState().masks);
  masks.delete(assetId);
  aiStore.setState({ masks });
  const db = store();
  if (db) await del(assetId, db).catch(() => {});
}

const checked = new Set<string>();

/**
 * Makes sure the art has its mask when AI removal is on: from this browser if
 * made before, else made now. A picture whose last try failed waits for Try again.
 */
export async function ensureAiMask(doc: Pick<TokenDocument, 'art'>): Promise<void> {
  const r = doc.art.removal;
  const id = doc.art.assetId;
  if (!r.enabled || r.method !== 'ai' || !id) return;
  const s = aiStore.getState();
  const busy = running.get(id);
  if (busy) return busy;
  if (s.masks.has(id) || s.status.get(id)?.state === 'error') return;
  if (!checked.has(id)) {
    checked.add(id);
    if (await restoreMask(id)) return;
  }
  const src = assetStore.getState().assets.get(id);
  if (src) await runAiRemoval(id, src);
}

/** Keeps AI masks made for the art on screen (switching batch pictures, undo, reload). Returns a stop function. */
export function watchAiRemoval(): () => void {
  void ensureAiMask(docHistory.getState().present);
  const stopDoc = docHistory.subscribe((s, prev) => {
    if (s.present.art !== prev.present.art) void ensureAiMask(s.present);
  });
  // The art's picture may arrive after the document (autosave restore).
  const stopAssets = assetStore.subscribe(() => void ensureAiMask(docHistory.getState().present));
  return () => {
    stopDoc();
    stopAssets();
  };
}
