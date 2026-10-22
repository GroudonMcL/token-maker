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
