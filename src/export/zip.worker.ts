// Web Worker: packs a batch of exported tokens into one ZIP, so a phone's
// page doesn't freeze while it is made. PNG and WebP are already
// compressed, so the files are stored as they are (fast, and no bigger).

import { zipSync, type Zippable } from 'fflate';

export interface ZipRequest {
  files: { name: string; data: Uint8Array }[];
}

export type ZipResponse = { ok: true; zip: Uint8Array } | { ok: false; message: string };

export function packZip(files: ZipRequest['files']): Uint8Array {
  const entries: Zippable = {};
  for (const f of files) entries[f.name] = [f.data, { level: 0 }];
  return zipSync(entries);
}

declare const WorkerGlobalScope: { new (): unknown } | undefined;

// Only listen when running as the worker (tests and the main-thread fallback import `packZip` too).
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = (e: MessageEvent<ZipRequest>) => {
    try {
      const zip = packZip(e.data.files);
      (self as unknown as Worker).postMessage({ ok: true, zip } satisfies ZipResponse, [zip.buffer]);
    } catch (err) {
      (self as unknown as Worker).postMessage({ ok: false, message: err instanceof Error ? err.message : String(err) } satisfies ZipResponse);
    }
  };
}
