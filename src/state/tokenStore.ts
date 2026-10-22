// The one store for the current token (DESIGN.md §4.3). Every change to the
// TokenDocument goes through here so it can be undone. Slider drags and
// canvas gestures use `transient` updates followed by `commit()`, so a whole
// drag is one undo step.

import { useStore } from 'zustand';
import { createDocument } from '../document/defaults';
import type { TokenDocument } from '../document/types';
import { createHistoryStore } from './history';

export const docHistory = createHistoryStore<TokenDocument>(createDocument());

/** The current document; re-renders when it changes. */
export function useDoc(): TokenDocument;
export function useDoc<T>(select: (doc: TokenDocument) => T): T;
export function useDoc<T>(select?: (doc: TokenDocument) => T) {
  return useStore(docHistory, (s) => (select ? select(s.present) : s.present));
}

export function useCanUndo() {
  return useStore(docHistory, (s) => s.past.length > 0 || s.pendingBase !== null);
}

export function useCanRedo() {
  return useStore(docHistory, (s) => s.future.length > 0);
}

export function getDoc(): TokenDocument {
  return docHistory.getState().present;
}

/**
 * Changes the document. `recipe` gets the current document and returns the
 * new one (never mutate it). Pass `{ transient: true }` while dragging.
 */
export function updateDoc(recipe: (doc: TokenDocument) => TokenDocument, opts?: { transient?: boolean }): void {
  docHistory.getState().set(recipe(getDoc()), opts);
}

export const commitDoc = () => docHistory.getState().commit();
export const undo = () => docHistory.getState().undo();
export const redo = () => docHistory.getState().redo();

/** Replaces the document and forgets history (new token, or loading autosave). */
export function resetDoc(doc: TokenDocument = createDocument()): void {
  docHistory.getState().reset(doc);
}
