// The Export buttons (DESIGN.md §6.11): download or copy the token on
// screen, or every token of a batch as a ZIP, with a progress bar.

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { batchStore, docForItem, syncedItems } from '../batch/batch';
import { forgetArt } from '../image/artWorker';
import { getAssets } from '../state/assets';
import { getDoc } from '../state/tokenStore';
import { toast } from '../ui/toast';
import { baseNameFor, getExportSettings, uniqueFileNames } from '../export/exportSettings';
import { copyPng, downloadBlob, exportToken, nextFrame, type ExportOptions } from '../export/exportToken';
import { FORMATS } from '../export/formats';
import { makeZip } from '../export/zip';

export interface ExportProgress {
  busy: boolean;
  /** Tokens finished so far, of `total`. */
  done: number;
  total: number;
  /** What is happening, e.g. "Token 3 of 6". */
  label: string;
  cancelled: boolean;
}

const IDLE: ExportProgress = { busy: false, done: 0, total: 0, label: '', cancelled: false };
export const exportProgress = createStore<ExportProgress>(() => IDLE);
export const useExportProgress = <T>(select: (s: ExportProgress) => T) => useStore(exportProgress, select);

/** Stops a batch export after the token being drawn. */
export const cancelExport = () => exportProgress.setState({ cancelled: true });

function options(): ExportOptions {
  const { format, pxPerSquare, quality } = getExportSettings();
  return { format, pxPerSquare, quality };
}

const NO_ART = 'Add an image first: upload, drop or paste one.';
const messageOf = (err: unknown) => (err instanceof Error ? err.message : 'The export failed.');

/** Downloads the token on screen with the Export panel's choices, and says so. */
export async function exportCurrentToken(): Promise<void> {
  const doc = getDoc();
  if (!doc.art.assetId) {
    toast(NO_ART, 'error');
    return;
  }
  if (exportProgress.getState().busy) return;
  const opts = options();
  const name = `${baseNameFor(doc.name)}.${FORMATS[opts.format].ext}`;
  exportProgress.setState({ ...IDLE, busy: true, total: 1, label: `Making ${name}…` });
  try {
    const blob = await exportToken(doc, getAssets(), opts);
    downloadBlob(blob, name);
    toast(`Downloaded ${name}`);
  } catch (err) {
    toast(messageOf(err), 'error');
  } finally {
    exportProgress.setState(IDLE);
  }
}

/** Copies the token on screen to the clipboard as a PNG (the only picture type clipboards take everywhere). */
export async function copyCurrentToken(): Promise<void> {
  const doc = getDoc();
  if (!doc.art.assetId) {
    toast(NO_ART, 'error');
    return;
  }
  try {
    // Started before any waiting, so the copy still counts as part of the click (Safari).
    await copyPng(exportToken(doc, getAssets(), { ...options(), format: 'png' }));
    toast('Copied the token. Paste it into your VTT or anywhere else.');
  } catch (err) {
    toast(messageOf(err), 'error', 8000);
  }
}

/**
 * Exports every token of the batch, each with its own name, into one ZIP.
 * Tokens are drawn one at a time; pictures not on screen let go of their
 * full-size art once drawn, to keep memory low on phones.
 */
export async function exportAllTokens(): Promise<void> {
  if (exportProgress.getState().busy) return;
  const shared = getDoc();
  const batch = batchStore.getState();
  const items = syncedItems(batch, shared).filter((it) => it.assetId);
  if (!items.length) {
    toast(NO_ART, 'error');
    return;
  }
  const opts = options();
  const names = uniqueFileNames(
    items.map((it) => (it.id === batch.activeId ? baseNameFor(it.name) : it.name)),
    FORMATS[opts.format].ext,
  );
  const total = items.length;
  exportProgress.setState({ ...IDLE, busy: true, total, label: `Token 1 of ${total}` });
  const files: { name: string; blob: Blob }[] = [];
  try {
    for (const [i, item] of items.entries()) {
      if (exportProgress.getState().cancelled) {
        toast('Export stopped.');
        return;
      }
      exportProgress.setState({ done: i, label: `Token ${i + 1} of ${total}: ${names[i]}` });
      const assets = getAssets();
      files.push({ name: names[i]!, blob: await exportToken(docForItem(shared, item), assets, opts) });
      const src = item.assetId ? assets.get(item.assetId) : undefined;
      if (src && item.id !== batch.activeId) forgetArt(src);
    }
    exportProgress.setState({ done: total, label: 'Packing the ZIP…' });
    await nextFrame();
    const zip = await makeZip(files);
    downloadBlob(zip, 'tokens.zip');
    toast(`Downloaded tokens.zip with ${total} token${total === 1 ? '' : 's'}`);
  } catch (err) {
    toast(messageOf(err), 'error', 8000);
  } finally {
    exportProgress.setState(IDLE);
  }
}

/** The main Export button: every token as a ZIP in batch mode (with more than one), else the token on screen. */
export function exportMain(): Promise<void> {
  const b = batchStore.getState();
  return b.on && b.items.length > 1 ? exportAllTokens() : exportCurrentToken();
}
