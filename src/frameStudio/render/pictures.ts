// The photo textures' pictures, loaded when first used. The renderer draws
// synchronously, so a picture that isn't loaded yet is drawn as its average
// colour, and loading it starts; when it arrives every listener hears (the
// preview and thumbnails draw again) and the layer cache's key changes
// (pictureEpoch). Exports and Token Maker load what a design uses first
// (loadPictures), so they never get the stand-in colour.

import type { Paint } from '../project/types';

export interface PictureImage {
  width: number;
  height: number;
}

type Decode = (dataUrl: string) => Promise<PictureImage>;

/** The browser's decoder; tests and scripts set @napi-rs/canvas's (setPictureDecoder). */
let decode: Decode = async (url) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
};

export function setPictureDecoder(fn: Decode): void {
  decode = fn;
}

const loaded = new Map<string, PictureImage>();
const loading = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let epoch = 0;

/** Changes whenever a picture arrives, so cached layers that use pictures are drawn again. */
export const pictureEpoch = () => epoch;

/** Calls `fn` whenever a picture has loaded; returns the way to stop. */
export function onPictureLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function load(id: string): Promise<void> {
  let p = loading.get(id);
  if (!p) {
    p = import('./pictureData')
      .then(async ({ PICTURE_DATA }) => {
        const url = PICTURE_DATA[id];
        if (!url) return;
        loaded.set(id, await decode(url));
        epoch++;
        for (const fn of listeners) fn();
      })
      .catch(() => {
        // Stays the average colour; a later use tries again.
        loading.delete(id);
      });
    loading.set(id, p);
  }
  return p;
}

/** The picture, or null while it loads (loading starts). */
export function pictureImage(id: string): CanvasImageSource | null {
  const img = loaded.get(id);
  if (img) return img as unknown as CanvasImageSource;
  void load(id);
  return null;
}

/** Every picture a value (a project, a layer, a paint) uses, found anywhere inside it. */
export function picturesIn(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (o.kind === 'picture' && typeof o.picture === 'string') found.add(o.picture);
      Object.values(o).forEach(walk);
    }
  };
  walk(value);
  return [...found];
}

/** Loads the pictures a value uses (before an export, or in Token Maker before drawing a design). */
export async function loadPictures(value: unknown): Promise<void> {
  await Promise.all(picturesIn(value).map(load));
}

export type PicturePaint = Extract<Paint, { kind: 'picture' }>;
