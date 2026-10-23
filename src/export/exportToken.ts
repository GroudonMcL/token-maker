// Making the exported picture (DESIGN.md §6.11). The export always comes
// from the same renderer as the preview: `render(doc, assets, size)`.
//
// Keeping phones smooth: the heavy pixel work (the full-size processed art)
// is done by the art Web Worker before rendering, the browser encodes the
// PNG/WebP off the main thread, and a batch ZIP is packed in its own Web
// Worker (`zip.worker.ts`). The render itself is one token at a time, with a
// pause between tokens so the page and its progress bar can update, and each
// finished canvas is emptied straight away so a phone never holds more than
// one full-size token.

import type { TokenDocument } from '../document/types';
import { prepareArt } from '../image/artWorker';
import { ensureLabelFont } from '../fonts/fontLoader';
import { getAssets } from '../state/assets';
import { loadFrameImage } from '../state/frameLibrary';
import { ensureLibraryImages } from '../state/libraryAssets';
import { ensurePictures } from '../state/pictureLibrary';
import { ensureAiMask } from '../image/aiRemoval';
import { render, type AssetMap } from '../render/render';
import { FORMATS, finalSize, type ExportFormat } from './formats';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface ExportOptions {
  format: ExportFormat;
  pxPerSquare: number;
  /** 1…100 (WebP). */
  quality: number;
}

/** Loads everything the renderer needs at full quality: art, background and frame pictures, the label's font. */
export async function prepareForExport(doc: TokenDocument, assets: AssetMap): Promise<AssetMap> {
  await ensureAiMask(doc); // an AI cut-out, made for this picture if it hasn't been yet
  await prepareArt(doc, assets); // full-size processed art, usually ready already
  await ensureLibraryImages(doc); // a built-in background picture, usually loaded already
  if (doc.frame.kind === 'image' && doc.frame.image) await loadFrameImage(doc.frame.image.source).catch((e) => console.warn(e)); // the picture frame
  await ensurePictures(doc); // picture effects and decorations
  await ensureLabelFont(doc); // the label's font, so it is never drawn with a fallback
  // The store may have gained the background or frame picture since `assets` was read.
  return new Map([...getAssets(), ...assets]);
}

/** Draws the token for export: the renderer's own picture at the chosen size. Every format keeps it see-through. */
export function renderForExport(doc: TokenDocument, assets: AssetMap, opts: Pick<ExportOptions, 'pxPerSquare'>): AnyCanvas {
  const { side } = finalSize(doc.size.squares, opts.pxPerSquare);
  return render(doc, assets, side);
}

/** Thrown when the browser can't write the chosen format (Safari and WebP). */
export class FormatUnsupportedError extends Error {
  constructor(readonly format: ExportFormat) {
    super(`This browser can't save ${FORMATS[format].label} files. Choose PNG instead.`);
  }
}

/** Turns a canvas into a file of the chosen format. */
export async function encodeCanvas(canvas: AnyCanvas, format: ExportFormat, quality: number): Promise<Blob> {
  const info = FORMATS[format];
  const q = info.lossy ? Math.min(1, Math.max(0.01, quality / 100)) : undefined;
  const blob =
    'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: info.mime, quality: q })
      : await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the picture. Try a smaller size.'))), info.mime, q),
        );
  // Browsers that can't write a format quietly hand back a PNG instead.
  if (blob.type && blob.type !== info.mime) throw new FormatUnsupportedError(format);
  return blob;
}

/** Lets go of a canvas's memory now rather than whenever the browser gets round to it (matters on phones). */
export function releaseCanvas(canvas: AnyCanvas): void {
  canvas.width = 0;
  canvas.height = 0;
}

/** The whole export of one token: prepare, render, encode. */
export async function exportToken(doc: TokenDocument, assets: AssetMap, opts: ExportOptions): Promise<Blob> {
  const ready = await prepareForExport(doc, assets);
  await nextFrame(); // let the page show "Exporting…" before the render
  const canvas = renderForExport(doc, ready, opts);
  try {
    return await encodeCanvas(canvas, opts.format, opts.quality);
  } finally {
    releaseCanvas(canvas);
  }
}

/** Waits for the page to draw a frame (so progress shows), or a moment where there are no frames. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined' || typeof document === 'undefined' || document.hidden) setTimeout(resolve, 0);
    else requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

/** Saves a file to the visitor's downloads. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** True when this browser can put a picture on the clipboard. */
export function canCopyImages(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard?.write && typeof ClipboardItem !== 'undefined';
}

/**
 * Copies a PNG to the clipboard. The clipboard item is made straight away
 * with the picture still on its way, because Safari only allows copying
 * during the click itself.
 */
export async function copyPng(png: Promise<Blob>): Promise<void> {
  if (!canCopyImages()) throw new Error("This browser can't copy pictures. Use Download instead.");
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  } catch (err) {
    await png; // a render problem is the real error
    console.warn(err);
    throw new Error("The browser didn't allow copying the picture. Use Download instead.");
  }
}
