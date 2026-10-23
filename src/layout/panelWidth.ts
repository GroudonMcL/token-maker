// The side panel's width (owner request after Phase 10): dragged wider or
// narrower and remembered in this browser.

export const PANEL_MIN = 280;
export const PANEL_MAX = 760;
const KEY = 'tm.panelWidth';

/** Widest the panel may be: never more than 60 % of the window, so the token stays visible. */
export const panelMax = () => Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(window.innerWidth * 0.6)));
export const clampPanel = (w: number) => Math.round(Math.min(panelMax(), Math.max(PANEL_MIN, w)));

/** The saved panel width, or null for the layout's own (360 px, 290 px on tablets). */
export function readPanelWidth(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY));
    return n >= PANEL_MIN ? n : null;
  } catch {
    return null;
  }
}

export function savePanelWidth(w: number | null): void {
  try {
    if (w === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(w));
  } catch {
    /* storage blocked: the width just won't be remembered */
  }
}
