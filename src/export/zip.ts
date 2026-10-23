// Makes a ZIP in the Web Worker (zip.worker.ts), or right here where
// workers aren't available.

import type { ZipRequest, ZipResponse } from './zip.worker';

export async function makeZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const read = async () => Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })));
  let zip: Uint8Array;
  try {
    zip = await inWorker(await read());
  } catch {
    // The bytes were handed to the worker, so read them again.
    zip = (await import('./zip.worker')).packZip(await read());
  }
  return new Blob([zip as BlobPart], { type: 'application/zip' });
}

function inWorker(files: ZipRequest['files']): Promise<Uint8Array> {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('no workers'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./zip.worker.ts', import.meta.url), { type: 'module' });
    const end = () => worker.terminate();
    worker.onmessage = (e: MessageEvent<ZipResponse>) => {
      end();
      if (e.data.ok) resolve(e.data.zip);
      else reject(new Error(e.data.message));
    };
    worker.onerror = (e) => {
      end();
      reject(new Error(e.message || 'The ZIP worker failed'));
    };
    // Hand the bytes over rather than copying them.
    worker.postMessage({ files } satisfies ZipRequest, files.map((f) => f.data.buffer as ArrayBuffer));
  });
}
