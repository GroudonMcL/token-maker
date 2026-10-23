import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHelp, type HelpId } from '../help/helpContent';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { HelpMedia } from './HelpMedia';

/**
 * The "?" help button (DESIGN.md §11). Hover or keyboard focus opens it on
 * desktop; tap/click toggles it everywhere. Escape or clicking elsewhere
 * closes it. Screen readers get the text through aria-describedby.
 */
export function HelpTip({ id, className }: { id: HelpId; className?: string }) {
  const entry = getHelp(id);
  const popId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // opened by click/tap: stays until dismissed
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const closeTimer = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  // Place the card below the button (or above if there is no room), kept on screen.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const b = btnRef.current!.getBoundingClientRect();
      const w = Math.min(280, window.innerWidth - 16);
      const h = popRef.current?.offsetHeight ?? 120;
      const above = b.bottom + 8 + h > window.innerHeight && b.top - 8 - h > 0;
      const left = Math.max(8, Math.min(b.left + b.width / 2 - w / 2, window.innerWidth - w - 8));
      setPos({ top: above ? b.top - 8 - h : b.bottom + 8, left, above });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  const hoverOpen = () => {
    if (!canHover) return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = () => {
    if (!canHover || pinned) return;
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const media = entry.media;
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={['help-tip', className].filter(Boolean).join(' ')}
        aria-label={`Help: ${entry.title}`}
        aria-expanded={open}
        aria-describedby={popId}
        data-help-tip={id}
        onClick={(e) => {
          e.stopPropagation();
          if (open && pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onFocus={() => canHover && setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
      >
        ?
      </button>
      {/* Always in the DOM (hidden when closed) so aria-describedby works for screen readers. */}
      {createPortal(
        <div
          ref={popRef}
          id={popId}
          role="tooltip"
          className="help-card"
          hidden={!open}
          data-above={pos?.above || undefined}
          style={pos ? { top: pos.top, left: pos.left } : undefined}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
        >
          <strong className="help-card__title">{entry.title}</strong>
          <span className="help-card__text">{entry.text}</span>
          {open && media && <HelpMedia media={media} />}
        </div>,
        document.body,
      )}
    </>
  );
}
