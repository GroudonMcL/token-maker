import { RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { HelpId } from '../help/helpContent';
import { ControlLabel } from './ControlLabel';

/**
 * A slider with a value box you can type into (DESIGN.md §10).
 *
 * `onChange` fires continuously while dragging; `onCommit` fires once when a
 * drag, key press or typed entry finishes. Wire `onChange` to a transient
 * store update and `onCommit` to the store's commit so a whole drag is one
 * undo step (DESIGN.md §4.3). With a `defaultValue`, a small button left
 * of the value box puts it back to that (owner request after Phase 10).
 */
export function Slider({
  label,
  helpId,
  value,
  min,
  max,
  step = 1,
  unit = '',
  defaultValue,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  helpId: HelpId;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Marked with a small notch under the track. */
  defaultValue?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  const id = useId();
  const dragging = useRef(false);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const [draft, setDraft] = useState<string | null>(null); // text while typing

  const clamp = (v: number) => {
    const stepped = Math.round((v - min) / step) * step + min;
    const decimals = (String(step).split('.')[1] ?? '').length;
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(decimals));
  };

  const finish = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit?.(latest.current);
  };

  // A drag may end outside the slider, so listen on the window.
  useEffect(() => {
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  });

  const commitDraft = () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || Number.isNaN(n)) return;
    const v = clamp(n);
    if (v !== value) onChange(v);
    onCommit?.(v);
  };

  const reset = () => {
    if (defaultValue === undefined) return;
    const v = clamp(defaultValue);
    setDraft(null);
    if (v !== value) onChange(v);
    onCommit?.(v);
  };

  const pct = ((value - min) / (max - min)) * 100;
  const defaultPct = defaultValue === undefined ? null : ((Math.min(max, Math.max(min, defaultValue)) - min) / (max - min)) * 100;

  return (
    <div className="slider" data-control="slider" data-help-id={helpId}>
      <ControlLabel
        htmlFor={id}
        label={label}
        helpId={helpId}
        aside={
          <span className="slider__value">
            {defaultValue !== undefined && (
              <button
                type="button"
                className="slider__reset"
                aria-label={`Reset ${label}`}
                title={`Reset to ${clamp(defaultValue)}${unit && !unit.includes(' ') ? unit : ''}`}
                disabled={disabled || clamp(defaultValue) === value}
                onClick={reset}
              >
                <RotateCcw size={13} aria-hidden="true" />
              </button>
            )}
            <input
              className="slider__number"
              type="text"
              inputMode="decimal"
              aria-label={`${label} value`}
              disabled={disabled}
              value={draft ?? String(value)}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDraft();
                if (e.key === 'Escape') setDraft(null);
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const v = clamp(value + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1));
                  setDraft(null);
                  onChange(v);
                  onCommit?.(v);
                }
              }}
            />
            {unit && <span className="slider__unit">{unit}</span>}
          </span>
        }
      />
      <div className="slider__track">
        <input
          id={id}
          className="slider__range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          style={{ '--fill': `${pct}%` } as CSSProperties}
          onPointerDown={() => {
            dragging.current = true;
          }}
          onChange={(e) => {
            latest.current = Number(e.target.value);
            onChange(latest.current);
          }}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
              onCommit?.(latest.current);
            }
          }}
        />
        {defaultPct !== null && <span className="slider__notch" aria-hidden="true" style={{ left: `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${defaultPct / 100})` }} />}
      </div>
    </div>
  );
}
