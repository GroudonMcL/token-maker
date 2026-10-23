import { batchStore, clearBatch } from '../batch/batch';
import { clearAutosave } from '../state/autosave';
import { clearAssets } from '../state/assets';
import { getDoc, resetDoc } from '../state/tokenStore';

/** "New": clears the token (and every picture of a batch) and its autosave (DESIGN.md §4.4). */
export async function startNewToken(): Promise<void> {
  const many = batchStore.getState().items.length > 1;
  const question = many ? 'Start again? Every token in the batch will be cleared.' : 'Start a new token? The current one will be cleared.';
  if ((getDoc().art.assetId || many) && !window.confirm(question)) return;
  resetDoc();
  clearBatch();
  clearAssets();
  await clearAutosave();
}
