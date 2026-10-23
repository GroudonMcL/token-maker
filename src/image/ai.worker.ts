// Web Worker: AI background removal, all in the browser (owner request after
// Phase 10). The model is BiRefNet-lite (MIT licence) re-exported at 512 ×
// 512: the usual 1024 × 1024 export needs about 8 GB and runs out of memory
// in a browser. It downloads from Hugging Face the first time (about 100 MB)
// and is then kept in the browser's cache.
// The picture itself never leaves the device. transformers.js is only loaded
// here, so the editor's own code stays small.

import { env, pipeline, RawImage } from '@huggingface/transformers';
import type { PixelBuffer } from './adjust';

const AI_MODEL = 'studioludens/birefnet-lite-512';

export type AiRequest = { type: 'run'; id: number; pixels: PixelBuffer };

export type AiResponse =
  | { type: 'progress'; id: number; stage: 'download' | 'thinking'; progress: number }
  | { type: 'done'; id: number; mask: Uint8Array; width: number; height: number }
  | { type: 'failed'; id: number; message: string };

env.allowLocalModels = false;

type Segmenter = (image: RawImage) => Promise<{ mask: RawImage }[]>;
let segmenter: Promise<Segmenter> | null = null;

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return !!gpu && !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

function load(onProgress: (p: number) => void): Promise<Segmenter> {
  segmenter ??= (async () => {
    const device = (await hasWebGpu()) ? 'webgpu' : 'wasm';
    const seg = await pipeline('image-segmentation', AI_MODEL, {
      device,
      dtype: 'fp16',
      progress_callback: (info: { status: string; progress?: number }) => {
        if (info.status === 'progress_total' && typeof info.progress === 'number') onProgress(info.progress);
      },
    });
    return seg as unknown as Segmenter;
  })().catch((err) => {
    segmenter = null; // try again next time
    throw err;
  });
  return segmenter;
}

self.onmessage = async (e: MessageEvent<AiRequest>) => {
  const { id, pixels } = e.data;
  try {
    const seg = await load((progress) => post({ type: 'progress', id, stage: 'download', progress }));
    post({ type: 'progress', id, stage: 'thinking', progress: 0 });
    const [first] = await seg(new RawImage(pixels.data, pixels.width, pixels.height, 4));
    if (!first) throw new Error('The AI found nothing to keep.');
    const mask = first.mask;
    const data = mask.channels === 1 ? Uint8Array.from(mask.data) : Uint8Array.from({ length: mask.width * mask.height }, (_, i) => mask.data[i * mask.channels]!);
    post({ type: 'done', id, mask: data, width: mask.width, height: mask.height }, [data.buffer]);
  } catch (err) {
    post({ type: 'failed', id, message: err instanceof Error ? err.message : String(err) });
  }
};

function post(msg: AiResponse, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}
