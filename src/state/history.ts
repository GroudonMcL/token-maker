import { createStore, type StoreApi } from 'zustand/vanilla';

/**
 * Undo/redo history for one value (DESIGN.md §4.3). The TokenDocument store
 * will use this in a later phase.
 *
 * - `set(next)` records one undo step.
 * - `set(next, { transient: true })` updates the value live (e.g. while a
 *   slider is being dragged) without recording a step; `commit()` then turns
 *   the whole drag into a single undo step.
 */
export interface HistoryState<T> {
  present: T;
  past: T[];
  future: T[];
  /** Value before the current transient change began, or null. */
  pendingBase: T | null;
  set: (next: T, opts?: { transient?: boolean }) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  reset: (value: T) => void;
}

export function createHistoryStore<T>(initial: T, limit = 200): StoreApi<HistoryState<T>> {
  const trim = (past: T[]) => (past.length > limit ? past.slice(past.length - limit) : past);

  return createStore<HistoryState<T>>((set, get) => ({
    present: initial,
    past: [],
    future: [],
    pendingBase: null,

    set: (next, opts) => {
      const { present, past, pendingBase } = get();
      if (opts?.transient) {
        set({ present: next, pendingBase: pendingBase ?? present });
        return;
      }
      const base = pendingBase ?? present;
      if (Object.is(base, next)) {
        set({ present: next, pendingBase: null });
        return;
      }
      set({ present: next, past: trim([...past, base]), future: [], pendingBase: null });
    },

    commit: () => {
      const { present, past, pendingBase } = get();
      if (pendingBase === null) return;
      if (Object.is(pendingBase, present)) {
        set({ pendingBase: null });
        return;
      }
      set({ past: trim([...past, pendingBase]), future: [], pendingBase: null });
    },

    undo: () => {
      get().commit();
      const { present, past, future } = get();
      const prev = past[past.length - 1];
      if (past.length === 0) return;
      set({ present: prev as T, past: past.slice(0, -1), future: [present, ...future] });
    },

    redo: () => {
      const { present, past, future } = get();
      if (future.length === 0) return;
      set({ present: future[0] as T, past: [...past, present], future: future.slice(1) });
    },

    reset: (value) => set({ present: value, past: [], future: [], pendingBase: null }),
  }));
}
