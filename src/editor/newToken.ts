import { clearAutosave } from '../state/autosave';
import { clearAssets } from '../state/assets';
import { setTool } from '../state/toolStore';
import { getDoc, resetDoc } from '../state/tokenStore';

/** "New": clears the token and its autosave (DESIGN.md §4.4). */
export async function startNewToken(): Promise<void> {
  if (getDoc().art.assetId && !window.confirm('Start a new token? The current one will be cleared.')) return;
  resetDoc();
  setTool('move');
  clearAssets();
  await clearAutosave();
}
