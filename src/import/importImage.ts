// Turns a file (upload, drop or paste) into the token's art (DESIGN.md §6.1).

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

export async function importImageFile(file: File | Blob, fileName = (file as File).name ?? ''): Promise<void> {
  if (!isImageFile({ type: file.type, name: fileName })) {
    throw new ImageDecodeError("That isn't an image file. Try PNG, JPG, WebP, GIF, AVIF, BMP or SVG.");
  }
  const decoded = await decodeImage(file);
  const id = newAssetId();
  addAsset({ id, blob: file, ...decoded });
  const name = tidyName(fileName);
  updateDoc((doc) => ({
    ...doc,
    name: name || (doc.art.assetId ? doc.name : createDocument().name),
    art: {
      ...doc.art,
      assetId: id,
      transform: initialTransform(decoded.width, decoded.height, imageClipPolygon(doc)),
      // Adjustments carry over to the new picture; brush strokes and a picked colour belong to the old one.
      removal: { ...doc.art.removal, color: null },
      strokes: [],
    },
  }));
}
