import { useEffect } from 'react';
import { redo, undo } from '../state/tokenStore';

/** Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (Cmd on Mac) for undo and redo (DESIGN.md §4.3). */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      // Text boxes keep their own undo.
      if ((e.target as HTMLElement | null)?.closest('input[type="text"], input:not([type]), textarea, [contenteditable]')) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
