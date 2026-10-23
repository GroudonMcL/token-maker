// How much of each panel section shows (owner request after Phase 10):
//   simple   — no Advanced drop-downs at all
//   advanced — Advanced drop-downs, closed until clicked (the default)
//   expert   — the Advanced settings always showing, with no drop-down
// A viewing preference, not part of the token, so it lives in localStorage.

import { create } from 'zustand';

export type MenuStyle = 'simple' | 'advanced' | 'expert';
const KEY = 'tm.menuStyle';

function read(): MenuStyle {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'simple' || v === 'expert' ? v : 'advanced';
  } catch {
    return 'advanced';
  }
}

export const useMenuStyle = create<MenuStyle>(read);

export function setMenuStyle(style: MenuStyle): void {
  useMenuStyle.setState(style, true);
  try {
    if (style === 'advanced') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, style);
  } catch {
    /* storage blocked: the choice just won't be remembered */
  }
}
