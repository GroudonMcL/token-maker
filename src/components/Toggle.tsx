import { useId } from 'react';
import type { HelpId } from '../help/helpContent';
import { HelpTip } from './HelpTip';

/** An on/off switch with its label and "?" tip. */
export function Toggle({
  label,
  helpId,
  checked,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  helpId: HelpId;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Hide the visible label (still read by screen readers). */
  compact?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle" data-control="toggle" data-help-id={helpId}>
      <label htmlFor={id} className={compact ? 'visually-hidden' : 'toggle__label'}>
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="toggle__switch"
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__thumb" />
      </button>
      <HelpTip id={helpId} />
    </div>
  );
}
