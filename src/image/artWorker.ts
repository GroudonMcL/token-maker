// Sends full-size processed-art jobs to the Web Worker (art.worker.ts) and
// stores the answers in the processed-art cache. Preview jobs that are
// overtaken by newer edits are dropped; export jobs are always finished.
// Where workers aren't available the same work runs on the main thread.

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { TokenDocument } from '../document/types';
import type { AssetMap, RenderSource } from '../render/render';
import type { WorkerRequest, WorkerResponse } from './art.worker';
import { artEdits, editsKey, isUnedited, type ArtEdits } from './process';
import { forgetProcessedArt, fullSide, peekProcessedArt, processedArt, sourcePixels, storeProcessedArt, type ProcessedArt } from './processedArt';

/** Goes up whenever a full-size result arrives, so the preview redraws. */
const versionStore = createStore(() => ({ version: 0 }));
export const useProcessedVersion = () => useStore(versionStore, (s) => s.version);

interface Job {
  id: number;
  src: RenderSource;
  edits: ArtEdits;
  key: string;
  keep: boolean;
  resolvers: ((art: ProcessedArt | null) => void)[];
}

let worker: Worker | null | undefined;
let nextId = 1;
const pictureIds = new WeakMap<object, number>();
const sentPictures = new Set<number>();
let running: Job | null = null;
const waiting: Job[] = [];

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./art.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => finish(e.data);
    worker.onerror = () => {
      // The worker couldn't start: carry on without it.
      worker?.terminate();
      worker = null;
      sentPictures.clear();
      if (running) runHere(running);
    };
  }
  return worker;
}

function pictureId(src: RenderSource): number {
  let id = pictureIds.get(src.image);
  if (!id) pictureIds.set(src.image, (id = nextId++));
  return id;
}

/**
 * Asks for the full-size processed art. `keep` jobs (exports) always finish;
 * other jobs give way to newer ones and then resolve to null.
 */
export function requestFullArt(src: RenderSource, edits: ArtEdits, keep = false): Promise<ProcessedArt | null> {
  const ready = peekProcessedArt(src, edits);
  if (ready) return Promise.resolve(ready);
  const key = editsKey(edits);
  return new Promise((resolve) => {
    const same = [running, ...waiting].find((j) => j && j.src === src && j.key === key);
    if (same) {
      same.keep ||= keep;
      same.resolvers.push(resolve);
      return;
    }
    if (!keep) {
      for (let i = waiting.length - 1; i >= 0; i--) {
        if (!waiting[i]!.keep) waiting.splice(i, 1)[0]!.resolvers.forEach((r) => r(null));
      }
    }
    waiting.push({ id: nextId++, src, edits, key, keep, resolvers: [resolve] });
    pump();
  });
}

function pump() {
  if (running || !waiting.length) return;
  const job = (running = waiting.shift()!);
  const w = getWorker();
  if (!w) {
    setTimeout(() => runHere(job), 0);
    return;
  }
  const pid = pictureId(job.src);
  if (!sentPictures.has(pid)) {
    const pixels = sourcePixels(job.src, fullSide(job.src));
    const copy = { data: pixels.data.slice(), width: pixels.width, height: pixels.height };
    w.postMessage({ type: 'source', pictureId: pid, pixels: copy } satisfies WorkerRequest, [copy.data.buffer]);
    sentPictures.add(pid);
  }
  w.postMessage({ type: 'process', id: job.id, pictureId: pid, edits: job.edits } satisfies WorkerRequest);
}

function runHere(job: Job) {
  if (running !== job) return;
  done(job, processedArt(job.src, job.edits));
}

function finish(msg: WorkerResponse) {
  const job = running;
  if (!job || job.id !== msg.id) return;
  if (msg.type === 'failed') {
    runHere(job);
    return;
  }
  done(job, storeProcessedArt(job.src, job.edits, msg.pixels, msg.mask));
}

function done(job: Job, art: ProcessedArt) {
  running = null;
  job.resolvers.forEach((r) => r(art));
  versionStore.setState((s) => ({ version: s.version + 1 }));
  pump();
}

/** Makes sure the export has the full-size art ready (the renderer then finds it in the cache). */
export async function prepareArt(doc: TokenDocument, assets: AssetMap): Promise<void> {
  const src = doc.art.assetId ? assets.get(doc.art.assetId) : undefined;
  const edits = artEdits(doc);
  if (src && !isUnedited(edits)) await requestFullArt(src, edits, true);
}

/**
 * Lets go of a picture's processed art here and in the worker (a batch
 * export does this for each picture that isn't on screen, so a phone
 * doesn't keep every full-size picture in memory).
 */
export function forgetArt(src: RenderSource): void {
  forgetProcessedArt(src);
  const id = pictureIds.get(src.image);
  if (!id || !sentPictures.has(id) || [running, ...waiting].some((j) => j?.src === src)) return;
  sentPictures.delete(id);
  worker?.postMessage({ type: 'forget', pictureId: id } satisfies WorkerRequest);
}
