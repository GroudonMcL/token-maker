import { importImageFile } from '../import/importImage';
import { toast } from '../ui/toast';

/** Imports an image, showing a friendly message if it fails. */
export async function importWithMessage(file: File | Blob, name?: string): Promise<void> {
  try {
    await importImageFile(file, name);
  } catch (err) {
    toast(err instanceof Error ? err.message : "That image couldn't be opened.", 'error');
  }
}
