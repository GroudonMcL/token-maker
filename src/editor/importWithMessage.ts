import { isImageFile } from '../import/decode';
import { importTo, type ImportTarget } from '../import/importImage';
import { toast } from '../ui/toast';

/** Imports an image (as the art, or the background), showing a friendly message if it fails. */
export async function importWithMessage(file: File | Blob, name?: string, target: ImportTarget = 'art'): Promise<void> {
  try {
    await importTo(target, file, name);
  } catch (err) {
    toast(err instanceof Error ? err.message : "That image couldn't be opened.", 'error');
  }
}

/**
 * Imports several pictures one after another (batch mode: each joins the
 * batch). Files that aren't pictures are skipped, with one message.
 */
export async function importFiles(files: readonly File[]): Promise<void> {
  const images = files.filter((f) => isImageFile(f));
  if (files.length && !images.length) {
    toast("That isn't an image file. Try PNG, JPG, WebP, GIF, AVIF, BMP or SVG.", 'error');
    return;
  }
  let failed = 0;
  for (const file of images) {
    try {
      await importTo('art', file);
    } catch (err) {
      failed++;
      if (images.length === 1) toast(err instanceof Error ? err.message : "That image couldn't be opened.", 'error');
    }
  }
  if (images.length > 1) {
    const added = images.length - failed;
    toast(failed ? `Added ${added} of ${images.length} pictures; ${failed} couldn't be opened.` : `Added ${added} pictures to the batch.`, failed ? 'error' : undefined);
  }
}
