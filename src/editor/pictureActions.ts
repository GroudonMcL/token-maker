// Adding picture effects and picture decorations (v8): built-in ones, or the
// user's own picture, kept in this browser for next time.

import { MAX_DECORATIONS, MAX_EFFECTS, newPictureDecoration, newPictureEffect } from '../document/defaults';
import type { PictureSource } from '../document/types';
import { tidyName } from '../import/importImage';
import { decorationPicture } from '../render/pictureLibrary';
import { loadPicture, saveUploadedPicture } from '../state/pictureLibrary';
import { updateDoc } from '../state/tokenStore';
import { toast } from '../ui/toast';
import { selectDecoration } from './tools';

const failed = (e: unknown, fallback: string) => toast(e instanceof Error ? e.message : fallback, 'error');

/** Adds a picture effect on top of the stack. Returns its id. */
export async function addPictureEffect(image: PictureSource): Promise<string | null> {
  try {
    await loadPicture(image);
  } catch (e) {
    failed(e, "That picture couldn't be loaded.");
    return null;
  }
  const e = newPictureEffect(image);
  let added = false;
  updateDoc((d) => {
    if (d.effects.length >= MAX_EFFECTS) return d;
    added = true;
    return { ...d, effects: [...d.effects, e] };
  });
  return added ? e.id : null;
}

/** Keeps the user's own picture in this browser and adds it as an effect. */
export async function uploadPictureEffect(file: File): Promise<string | null> {
  try {
    const { id } = await saveUploadedPicture(file, tidyName(file.name) || 'My picture');
    return await addPictureEffect({ type: 'upload', id });
  } catch (e) {
    failed(e, "That picture couldn't be opened. Try a PNG, JPG or WebP.");
    return null;
  }
}

/** Adds a picture decoration and picks it. */
export async function addPictureDecoration(image: PictureSource): Promise<void> {
  let aspect = 1;
  try {
    const pic = await loadPicture(image);
    aspect = pic.width / Math.max(1, pic.height);
  } catch (e) {
    failed(e, "That picture couldn't be loaded.");
    return;
  }
  const lib = image.type === 'library' ? decorationPicture(image.id) : undefined;
  const d = newPictureDecoration(image, aspect, lib?.color);
  let added = false;
  updateDoc((doc) => {
    if (doc.decorations.length >= MAX_DECORATIONS) return doc;
    added = true;
    return { ...doc, decorations: [...doc.decorations, d] };
  });
  if (added) selectDecoration(d.id);
}

/** Keeps the user's own picture in this browser and adds it as a decoration. */
export async function uploadPictureDecoration(file: File): Promise<void> {
  try {
    const { id } = await saveUploadedPicture(file, tidyName(file.name) || 'My picture');
    await addPictureDecoration({ type: 'upload', id });
  } catch (e) {
    failed(e, "That picture couldn't be opened. Try a PNG, JPG or WebP.");
  }
}
