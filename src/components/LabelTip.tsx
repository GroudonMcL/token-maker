import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getHelp, type HelpId } from '../help/helpContent';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { HelpMedia } from './HelpMedia';

const OPEN_DELAY = 350;
const LONG_PRESS = 500;

/**
 * A control's name with its help card (DESIGN.md §11): controls inside a
 * section have no "?" button, so hovering the name (or a long press on a
 * touch screen) shows the same card, with its before/after picture where the
 * help entry has one.
 */
export function LabelTip({
  helpId,
  htmlFor,
  id,
  className,
  children,
}: {
  helpId: HelpId;
  /** Render a <label> for this control id; otherwise a <span>. */
  htmlFor?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const entry = getHelp(helpId);
  const cardId = useId();
  const ref = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 16);
    const h = cardRef.current?.offsetHeight ?? 120;
    const below = b.bottom + 6;
    const top = below + h > window.innerHeight && b.top - 6 - h > 0 ? b.top - 6 - h : below;
    setPos({ top, left: Math.max(8, Math.min(b.left, window.innerWidth - w - 8)) });
  }, [open]);

  // A long press opens it on touch screens; a tap anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!cardRef.current?.contains(e.target as Node) && !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const later = (fn: () => void, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };
  const props = {
    id,
    className,
    'data-label-tip': helpId,
    onPointerEnter: () => canHover && later(() => setOpen(true), OPEN_DELAY),
    onPointerLeave: () => canHover && later(() => setOpen(false), 120),
    onPointerDown: (e: React.PointerEvent) => e.pointerType === 'touch' && later(() => setOpen(true), LONG_PRESS),
    onPointerUp: () => !open && window.clearTimeout(timer.current),
    onContextMenu: (e: React.MouseEvent) => open && e.preventDefault(),
  };
  return (
    <>
      {htmlFor ? (
        <label ref={ref as React.Ref<HTMLLabelElement>} htmlFor={htmlFor} {...props}>
          {children}
        </label>
      ) : (
        <span ref={ref as React.Ref<HTMLSpanElement>} {...props}>
          {children}
        </span>
      )}
      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="tooltip"
            className="help-card"
            style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
            onPointerEnter={() => canHover && window.clearTimeout(timer.current)}
            onPointerLeave={() => canHover && later(() => setOpen(false), 120)}
          >
            <strong className="help-card__title">{entry.title}</strong>
            <span className="help-card__text">{entry.text}</span>
            {entry.media && <HelpMedia media={entry.media} />}
          </div>,
          document.body,
        )}
    </>
  );
}
