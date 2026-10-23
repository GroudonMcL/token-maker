import { useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark';
const KEY = 'tm.theme';

function read(): ThemeChoice {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** The user's theme choice (dark unless they pick light), saved in localStorage and applied as <html data-theme>. */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(read);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      if (theme === 'dark') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* storage blocked: the choice just won't be remembered */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}
