// Picking, uploading and nudging picture frames (DESIGN.md §6.9).

import type { ImageFrame, ImageFrameSource } from '../document/types';
import { tidyName } from '../import/importImage';
import { prepareImageFrame, saveUploadedFrame } from '../state/frameLibrary';
import { toast } from '../ui/toast';
import { updateFrameAndArt } from './artActions';

/** Switches to a picture frame, finding its hole first. */
export async function pickImageFrame(source: ImageFrameSource, name: string): Promise<void> {
  try {
    const { found, open, ...image } = await prepareImageFrame(source, name);
    updateFrameAndArt((d) => ({ ...d, frame: { ...d.frame, kind: 'image', image } }));
    if (!found) toast("This frame has no see-through middle, so a circle is used for the art. Change it with Hole size.", 'error');
    else if (open) toast("This frame isn't closed all the way round, so the hole is a best guess. Nudge it with the hole controls.");
  } catch (e) {
    toast(e instanceof Error ? e.message : "That frame couldn't be loaded.", 'error');
  }
}

/** Keeps an uploaded frame picture in this browser and uses it. */
export async function uploadFrame(file: File): Promise<void> {
  try {
    const name = tidyName(file.name) || 'My frame';
    const id = await saveUploadedFrame(file, name);
    await pickImageFrame({ type: 'upload', id }, name);
  } catch (e) {
    toast(e instanceof Error ? e.message : "That frame couldn't be opened. Try a PNG with a see-through middle.", 'error');
  }
}

/** Moves or resizes the hole of the picture frame in use. */
export function nudgeHole(patch: Partial<ImageFrame['nudge']>, transient = false): void {
  updateFrameAndArt(
    (d) => (d.frame.image ? { ...d, frame: { ...d.frame, image: { ...d.frame.image, nudge: { ...d.frame.image.nudge, ...patch } } } } : d),
    { transient },
  );
}
