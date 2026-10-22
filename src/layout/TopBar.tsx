import { FilePlus2, Monitor, Moon, Redo2, Sun, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Toggle } from '../components';
import { HelpTip } from '../components/HelpTip';
import { Link } from '../components/Link';
import { useTheme, type ThemeChoice } from '../hooks/useTheme';
import { BrandMark } from './BrandMark';

const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { system: 'dark', dark: 'light', light: 'system' };
const THEME_ICON = { system: Monitor, dark: Moon, light: Sun };

/** Logo, Batch toggle, Undo/Redo, New (DESIGN.md §8). Undo/Redo/New are wired up in a later phase. */
export function TopBar({ compact }: { compact: boolean }) {
  const [batch, setBatch] = useState(false);
  const [theme, setTheme] = useTheme();
  const ThemeIcon = THEME_ICON[theme];
  return (
    <header className="topbar">
      <Link href="/" className="topbar__brand" aria-label="Token Maker home">
        <BrandMark />
        {!compact && <span className="topbar__name">Token Maker</span>}
      </Link>
      <div className="topbar__spacer" />
      <Toggle label="Batch" helpId="topbar.batch" checked={batch} onChange={setBatch} />
      <div className="topbar__group" role="group" aria-label="History">
        <button type="button" className="icon-btn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled>
          <Undo2 size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Redo" title="Redo (Ctrl+Y)" disabled>
          <Redo2 size={18} />
        </button>
      </div>
      <button type="button" className="btn btn--ghost" title="Start a new token">
        <FilePlus2 size={18} aria-hidden="true" />
        {!compact && <span>New</span>}
        {compact && <span className="visually-hidden">New</span>}
      </button>
      <div className="topbar__group" data-control="theme" data-help-id="topbar.theme">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`}
          title={`Theme: ${theme}`}
          onClick={() => setTheme(NEXT_THEME[theme])}
        >
          <ThemeIcon size={18} />
        </button>
        {!compact && <HelpTip id="topbar.theme" />}
      </div>
    </header>
  );
}
