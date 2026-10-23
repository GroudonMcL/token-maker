import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { clampPanel, PANEL_MIN, panelMax, savePanelWidth } from './panelWidth';

/**
 * The drag handle on the side panel's left edge (desktop and tablet). Drag it
 * to widen or narrow the panel, use the arrow keys, or double-click it to go
 * back to the normal width.
 */
export function PanelResizer({
  width,
  onChange,
  panel,
}: {
  /** The chosen width, or null for the default. */
  width: number | null;
  onChange: (width: number | null) => void;
  /** The panel element, to read its current width when none is chosen yet. */
  panel: () => HTMLElement | null;
}) {
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  const current = () => width ?? panel()?.getBoundingClientRect().width ?? 360;
  const set = (w: number | null) => {
    const v = w === null ? null : clampPanel(w);
    onChange(v);
    savePanelWidth(v);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startW: current() };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    // The panel is on the right, so moving left makes it wider.
    if (d) set(d.startW + (d.startX - e.clientX));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 80 : 20;
    if (e.key === 'ArrowLeft') set(current() + step);
    else if (e.key === 'ArrowRight') set(current() - step);
    else if (e.key === 'Home') set(PANEL_MIN);
    else if (e.key === 'End') set(panelMax());
    else if (e.key === 'Enter' || e.key === 'Escape') set(null);
    else return;
    e.preventDefault();
  };
  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the settings panel"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={panelMax()}
      aria-valuenow={Math.round(current())}
      title="Drag to resize the panel (double-click to reset)"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => set(null)}
      onKeyDown={onKeyDown}
    />
  );
}
