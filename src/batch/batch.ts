// Batch mode (DESIGN.md §6.1): several pictures, one shared style.
//
// The editor always edits one TokenDocument. In batch mode that document is
// the token being looked at; the batch keeps, for every picture, only the
// parts that belong to that picture (`BatchItem`): its art and how it sits in
// the frame, its brush masks, its name and its label words. Everything else
// — frame, effects, lighting, adjustments… — is the shared style, read from
// the one document. So styling the token on screen styles them all, and any
// token in the batch is `docForItem(getDoc(), item)`.
//
// The item on screen lives in the document; its entry in `items` is brought
// up to date (`syncedItems`) whenever the batch is read.

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createDocument } from '../document/defaults';
import type { ArtTransform, MaskStroke, PopOutStroke, TokenDocument } from '../document/types';
import { imageClipPolygon, initialTransform } from '../render/geometry';
import { docHistory, getDoc } from '../state/tokenStore';

/** What each picture in a batch keeps for itself. */
export interface BatchItem {
  id: string;
  name: string;
  assetId: string | null;
  transform: ArtTransform;
  /** A background colour picked with the eyedropper for this picture (null = found from its edges). */
  removalColor: string | null;
  strokes: MaskStroke[];
  popOutStrokes: PopOutStroke[];
  /** The label's own words (null = the token's name). */
  labelText: string | null;
}

export interface BatchState {
  on: boolean;
  items: BatchItem[];
  /** The item shown in the editor, or null before the first picture. */
  activeId: string | null;
}

/** At most this many pictures in one batch (memory on phones). */
export const MAX_BATCH = 50;

export const batchStore = createStore<BatchState>(() => ({ on: false, items: [], activeId: null }));
export const useBatch = <T>(select: (s: BatchState) => T) => useStore(batchStore, select);
export const isBatchOn = () => batchStore.getState().on;

let counter = 0;
const newItemId = () => `item-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** The picture's own parts of a document. */
export function itemFromDoc(doc: TokenDocument, id: string): BatchItem {
  return {
    id,
    name: doc.name,
    assetId: doc.art.assetId,
    transform: doc.art.transform,
    removalColor: doc.art.removal.color,
    strokes: doc.art.strokes,
    popOutStrokes: doc.art.popOut.strokes,
    labelText: doc.label ? doc.label.text : null,
  };
}

/** The shared style with this picture's own parts: one token of the batch. */
export function docForItem(doc: TokenDocument, item: BatchItem): TokenDocument {
  return {
    ...doc,
    name: item.name,
    art: {
      ...doc.art,
      assetId: item.assetId,
      transform: item.transform,
      removal: { ...doc.art.removal, color: item.removalColor },
      strokes: item.strokes,
      popOut: { ...doc.art.popOut, strokes: item.popOutStrokes },
    },
    label: doc.label ? { ...doc.label, text: item.labelText } : null,
  };
}

/** The document without the picture's own parts: two documents with the same style give the same key. */
export function styleKey(doc: TokenDocument): string {
  const blank = docForItem(doc, { ...itemFromDoc(createDocument(), ''), transform: createDocument().art.transform });
  return JSON.stringify(blank);
}

/** Every item, with the one on screen brought up to date from the document. */
export function syncedItems(state: BatchState = batchStore.getState(), doc: TokenDocument = getDoc()): BatchItem[] {
  return state.items.map((it) => (it.id === state.activeId ? itemFromDoc(doc, it.id) : it));
}

/** The active item's index, or -1. */
export function activeIndex(state: BatchState = batchStore.getState()): number {
  return state.items.findIndex((it) => it.id === state.activeId);
}

/** Switches batch mode on (the token on screen becomes the first picture) or off (only the token on screen is kept). */
export function setBatchMode(on: boolean): void {
  const state = batchStore.getState();
  if (on === state.on) return;
  if (on) {
    const doc = getDoc();
    const id = newItemId();
    batchStore.setState({ on: true, items: doc.art.assetId ? [itemFromDoc(doc, id)] : [], activeId: doc.art.assetId ? id : null });
  } else {
    batchStore.setState({ on: false, items: [], activeId: null });
  }
}

/** How many pictures switching batch mode off would drop. */
export const droppedByTurningOff = () => Math.max(0, batchStore.getState().items.length - 1);

/**
 * Adds a picture to the batch. The first one is shown straight away
 * (through `showFirst`, which sets the document's art as a normal import
 * does); later ones wait in the strip with the current style.
 */
export function addBatchItem(
  picture: { assetId: string; width: number; height: number; name: string },
  showFirst: () => void,
): void {
  const state = batchStore.getState();
  const doc = getDoc();
  if (!state.activeId || !doc.art.assetId) {
    showFirst();
    const id = newItemId();
    const others = state.items.filter((it) => it.id !== state.activeId);
    batchStore.setState({ items: [...others, itemFromDoc(getDoc(), id)], activeId: id });
    return;
  }
  if (state.items.length >= MAX_BATCH) throw new Error(`A batch can hold up to ${MAX_BATCH} pictures.`);
  const item: BatchItem = {
    id: newItemId(),
    name: picture.name || `Token ${state.items.length + 1}`,
    assetId: picture.assetId,
    transform: initialTransform(picture.width, picture.height, imageClipPolygon(doc)),
    removalColor: null,
    strokes: [],
    popOutStrokes: [],
    labelText: null,
  };
  batchStore.setState({ items: [...syncedItems(state, doc), item] });
}

/**
 * Shows another picture of the batch. The undo history is kept for the
 * shared style: steps that only changed the previous picture's own parts
 * are dropped, and every other step keeps the new picture in place, so
 * Undo after switching undoes the last style change, never the switch.
 */
export function selectItem(id: string): void {
  const state = batchStore.getState();
  const target = state.items.find((it) => it.id === id);
  if (!target || id === state.activeId) return;
  docHistory.getState().commit();
  const items = syncedItems(state);
  const h = docHistory.getState();
  const swap = (d: TokenDocument) => docForItem(d, target);
  const dedupe = (list: TokenDocument[], keepLast: string) => {
    const out: TokenDocument[] = [];
    let prev = '';
    for (const d of list) {
      const key = styleKey(d);
      if (key !== prev) out.push(d);
      prev = key;
    }
    // A step whose style is the same as the present one undoes nothing visible.
    while (out.length && styleKey(out[out.length - 1]!) === keepLast) out.pop();
    return out;
  };
  const present = swap(h.present);
  const presentKey = styleKey(present);
  const past = dedupe(h.past.map(swap), presentKey);
  const future = dedupe([...h.future].reverse().map(swap), presentKey).reverse();
  docHistory.setState({ present, past, future, pendingBase: null });
  batchStore.setState({ items, activeId: id });
}

/** Moves to the next (+1) or previous (−1) picture. */
export function stepItem(by: 1 | -1): void {
  const state = batchStore.getState();
  const i = activeIndex(state);
  const next = state.items[(i + by + state.items.length) % state.items.length];
  if (next) selectItem(next.id);
}

/** Removes a picture from the batch (the one on screen is replaced by its neighbour). */
export function removeItem(id: string): void {
  const state = batchStore.getState();
  const i = state.items.findIndex((it) => it.id === id);
  if (i < 0) return;
  if (id === state.activeId) {
    const neighbour = state.items[i + 1] ?? state.items[i - 1];
    if (neighbour) selectItem(neighbour.id);
    else {
      // The last picture: back to an empty token with the same style.
      const doc = getDoc();
      docHistory.getState().set({ ...doc, name: createDocument().name, art: { ...doc.art, assetId: null, strokes: [], popOut: { ...doc.art.popOut, strokes: [] } } });
      batchStore.setState({ items: [], activeId: null });
      return;
    }
  }
  batchStore.setState((s) => ({ items: s.items.filter((it) => it.id !== id) }));
}

/** Empties the batch (a new token), keeping batch mode on or off as it is. */
export function clearBatch(): void {
  batchStore.setState({ items: [], activeId: null });
}

/** Restores a saved batch (autosave). */
export function loadBatch(state: BatchState): void {
  batchStore.setState(state);
}
