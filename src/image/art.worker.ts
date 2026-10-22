// Web Worker: computes full-size processed art off the main thread, so the
// page stays smooth while a 2048 px picture is adjusted. It keeps each
// picture's pixels and intermediate results, so only what changed is redone.

import type { PixelBuffer } from './adjust';
import { processPixels, type ArtEdits, type ProcessCache } from './process';

export type WorkerRequest =
  | { type: 'source'; pictureId: number; pixels: PixelBuffer }
  | { type: 'process'; id: number; pictureId: number; edits: ArtEdits }
  | { type: 'forget'; pictureId: number };

export type WorkerResponse =
  | { type: 'done'; id: number; pixels: PixelBuffer; mask: Uint8Array | null }
  | { type: 'failed'; id: number; message: string };

const pictures = new Map<number, { pixels: PixelBuffer; cache: ProcessCache }>();

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'source') {
    pictures.set(msg.pictureId, { pixels: msg.pixels, cache: {} });
  } else if (msg.type === 'forget') {
    pictures.delete(msg.pictureId);
  } else {
    const picture = pictures.get(msg.pictureId);
    if (!picture) {
      post({ type: 'failed', id: msg.id, message: 'unknown picture' });
      return;
    }
    try {
      const { pixels, mask } = processPixels(picture.pixels, msg.edits, picture.cache);
      // The cache keeps its own copy of the mask, so send a copy.
      const maskCopy = mask ? mask.slice() : null;
      post({ type: 'done', id: msg.id, pixels, mask: maskCopy }, [pixels.data.buffer, ...(maskCopy ? [maskCopy.buffer] : [])]);
    } catch (err) {
      post({ type: 'failed', id: msg.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
};

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}
