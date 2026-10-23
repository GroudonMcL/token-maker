// Turns a file (upload, drop or paste) into the token's art (DESIGN.md §6.1).

import { addBatchItem, isBatchOn } from '../batch/batch';
import { createDocument } from '../document/defaults';
import { imageClipPolygon, initialTransform } from '../render/geometry';
import { addAsset, newAssetId } from '../state/assets';
import { updateDoc } from '../state/tokenStore';
import { decodeImage, ImageDecodeError, isImageFile } from './decode';

/** A file name made into a token name: no extension, separators to spaces, tidy case and length. */
export function tidyName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]{1,5}$/i, '');
  const words = base
    .replace(/[_\-.+]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words || /^(image|img|pasted|clipboard|screenshot|untitled)( ?\d*)?$/i.test(words)) return '';
  const tidy = words === words.toLowerCase() ? words.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : words;
  return tidy.slice(0, 60).trim();
}

/** Where an imported picture goes: the token's art, or the background behind it (DESIGN.md §6.3). */
export type ImportTarget = 'art' | 'background';

/** Makes a picture the background (an "image" background of the user's own). */
export async function importBackgroundFile(file: File | Blob, fileName = (file as File).name ?? ''): Promise<void> {
  if (!isImageFile({ type: file.type, name: fileName })) {
    throw new ImageDecodeError("That isn't an image file. Try PNG, JPG, WebP, GIF, AVIF, BMP or SVG.");
  }
  const decoded = await decodeImage(file);
  const id = newAssetId();
  addAsset({ id, blob: file, ...decoded });
  updateDoc((doc) => ({
    ...doc,
    background: { ...doc.background, kind: 'image', image: { type: 'asset', assetId: id }, zoom: 1, offsetX: 0, offsetY: 0 },
  }));
}

/** Imports to the art or the background. */
export function importTo(target: ImportTarget, file: File | Blob, fileName?: string): Promise<void> {
  return target === 'background' ? importBackgroundFile(file, fileName) : importImageFile(file, fileName);
}

export async function importImageFile(file: File | Blob, fileName = (file as File).name ?? ''): Promise<void> {
  if (!isImageFile({ type: file.type, name: fileName })) {
    throw new ImageDecodeError("That isn't an image file. Try PNG, JPG, WebP, GIF, AVIF, BMP or SVG.");
  }
  const decoded = await decodeImage(file);
  const id = newAssetId();
  addAsset({ id, blob: file, ...decoded });
  const name = tidyName(fileName);
  const show = () => updateDoc((doc) => ({
    ...doc,
    name: name || (doc.art.assetId ? doc.name : createDocument().name),
    art: {
      ...doc.art,
      assetId: id,
      transform: initialTransform(decoded.width, decoded.height, imageClipPolygon(doc)),
      // Adjustments carry over to the new picture; brush strokes, the pop-out mask and a picked colour belong to the old one.
      removal: { ...doc.art.removal, color: null },
      strokes: [],
      popOut: { ...doc.art.popOut, strokes: [] },
    },
  }));
  // In batch mode a picture joins the batch instead of replacing the art (DESIGN.md §6.1).
  if (isBatchOn()) addBatchItem({ assetId: id, width: decoded.width, height: decoded.height, name }, show);
  else show();
}
