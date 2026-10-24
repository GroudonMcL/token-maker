// Frame Studio designs opened in Token Maker (DESIGN.md §6.12), kept in
// IndexedDB like uploaded picture frames (their own database, so "New token"
// never deletes them). A token keeps the design it uses inside its document,
// so this library is only for picking a design again.

import { createStore as createIdbStore, del, entries, get, set, type UseStore } from 'idb-keyval';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { previewOf, readFrameDesign, type FrameProject } from '../frameStudio/share/frameDesign';
import { newFrameId } from './frameLibrary';

/** A design as kept in IndexedDB: the file's text, so it is read (and migrated) again by Frame Studio's reader. */
export interface SavedDesign {
  id: string;
  name: string;
  text: string;
  added: number;
}

/** A saved design, read and ready to use. `preview` is the picture saved in the file, if it has one. */
export interface LibraryDesign {
  id: string;
  name: string;
  project: FrameProject;
  preview: string | null;
  added: number;
}

let idb: UseStore | null = null;
function store(): UseStore | null {
  if (typeof indexedDB === 'undefined') return null;
  idb ??= createIdbStore('token-maker-designs', 'designs');
  return idb;
}

export const designLibrary = createStore<{ designs: LibraryDesign[]; loaded: boolean }>(() => ({ designs: [], loaded: false }));
export const useDesignLibrary = () => useStore(designLibrary);

const read = (s: SavedDesign): LibraryDesign | null => {
  const r = readFrameDesign(s.text);
  return r.ok ? { id: s.id, name: s.name, project: r.project, preview: previewOf(s.text), added: s.added } : null;
};

/** Reads the saved designs, newest first. */
export async function refreshDesigns(): Promise<void> {
  const db = store();
  const all = db ? (await entries<string, SavedDesign>(db)).map(([, s]) => s).filter((s) => s && typeof s.text === 'string') : [];
  const designs = all.map(read).filter((d): d is LibraryDesign => d !== null);
  designs.sort((a, b) => b.added - a.added);
  designLibrary.setState({ designs, loaded: true });
}

/** Keeps a design (the text of its .framestudio.json file) in this browser. Returns its id. */
export async function saveDesign(text: string, name: string, id = newFrameId()): Promise<string> {
  const db = store();
  if (db) await set(id, { id, name: name.slice(0, 80), text, added: Date.now() } satisfies SavedDesign, db);
  await refreshDesigns();
  return id;
}

/** True when a design with this id is saved here. */
export async function hasDesign(id: string): Promise<boolean> {
  const db = store();
  return !!db && !!(await get(id, db));
}

export async function removeDesign(id: string): Promise<void> {
  const db = store();
  if (db) await del(id, db);
  await refreshDesigns();
}
