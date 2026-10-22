import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { HelpId } from '../help/helpContent';
import { ControlLabel } from './ControlLabel';
import { sideName } from './sides';

/**
 * A round dial for a direction (DESIGN.md §6.5): drag the dot round the
 * ring, use the arrow keys (Shift for bigger steps), or click a spot.
 * Degrees: 0 = right, 90 = below, 180 = left, 270 = above.
 *
 * Like Slider, `onChange` fires while dragging and `onCommit` once at the end.
 */
export function DirectionDial({
  label,
  helpId,
  value,
  onChange,
  onCommit,
  disabled,
  describe = (d) => `from ${sideName(d)}`,
}: {
  label: string;
  helpId: HelpId;
  value: number;
  onChange: (deg: number) => void;
  onCommit?: (deg: number) => void;
  disabled?: boolean;
  /** Words for the current value, for screen readers and the text beside the dial. */
  describe?: (deg: number) => string;
}) {
  const labelId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const latest = useRef(value);
  const norm = (d: number) => Math.round((((d % 360) + 360) % 360) * 10) / 10;

  const fromPointer = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const deg = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
    // Snap to whole degrees, and to 15° steps with Shift.
    const v = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
    latest.current = norm(v);
    onChange(latest.current);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 15 : 5;
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key as string];
    if (delta === undefined) return;
    e.preventDefault();
    const v = norm(value + delta);
    onChange(v);
    onCommit?.(v);
  };

  const rad = (value * Math.PI) / 180;
  return (
    <div className="dial" data-control="dial" data-help-id={helpId}>
      <ControlLabel id={labelId} label={label} helpId={helpId} aside={<span className="dial__value">{describe(value)}</span>} />
      <div
        ref={ref}
        className="dial__ring"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)}°, ${describe(value)}`}
        aria-disabled={disabled || undefined}
        onKeyDown={disabled ? undefined : onKeyDown}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          fromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => {
          if (!dragging.current) return;
          dragging.current = false;
          onCommit?.(latest.current);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          onCommit?.(latest.current);
        }}
      >
        <span className="dial__centre" aria-hidden="true" />
        <span className="dial__arm" aria-hidden="true" style={{ transform: `rotate(${value}deg)` }} />
        <span className="dial__dot" aria-hidden="true" style={{ left: `${50 + Math.cos(rad) * 40}%`, top: `${50 + Math.sin(rad) * 40}%` }} />
      </div>
    </div>
  );
}
