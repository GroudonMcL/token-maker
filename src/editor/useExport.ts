import { downloadPng } from '../export/exportPng';
import { getAssets } from '../state/assets';
import { getDoc } from '../state/tokenStore';
import { toast } from '../ui/toast';

/** Downloads the current token as a PNG and says so. */
export async function exportCurrentToken(): Promise<void> {
  const doc = getDoc();
  if (!doc.art.assetId) {
    toast('Add an image first: upload, drop or paste one.', 'error');
    return;
  }
  try {
    const name = await downloadPng(doc, getAssets());
    toast(`Downloaded ${name}`);
  } catch (err) {
    toast(err instanceof Error ? err.message : 'The download failed.', 'error');
  }
}
