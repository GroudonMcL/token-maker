import { useId, type ReactNode } from 'react';
import type { HelpId } from '../help/helpContent';
import { ControlLabel } from './ControlLabel';
import { useRovingRadio } from './useRovingRadio';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
  /** Show only the icon (label is still read by screen readers). */
  iconOnly?: boolean;
}

/** A row of joined buttons where exactly one is chosen. */
export function SegmentedButtons<V extends string>({
  label,
  helpId,
  options,
  value,
  onChange,
}: {
  label: string;
  helpId: HelpId;
  options: readonly SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  const labelId = useId();
  const { onKeyDown, itemProps } = useRovingRadio(
    options.map((o) => o.value),
    value,
    onChange,
  );
  return (
    <div className="segmented" data-control="segmented" data-help-id={helpId}>
      <ControlLabel id={labelId} label={label} helpId={helpId} />
      <div className="segmented__row" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            className="segmented__btn"
            aria-label={o.iconOnly ? o.label : undefined}
            title={o.iconOnly ? o.label : undefined}
            {...itemProps(o.value, i)}
          >
            {o.icon}
            {!o.iconOnly && <span>{o.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
