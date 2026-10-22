import { useId } from 'react';
import type { HelpId } from '../help/helpContent';
import { HelpTip } from './HelpTip';
import { LabelTip } from './LabelTip';

/** An on/off switch with its label. Top-bar switches add a "?" button; in the panel the label's hover card gives the help. */
export function Toggle({
  label,
  helpId,
  checked,
  onChange,
  disabled,
  compact,
  helpButton,
}: {
  label: string;
  helpId: HelpId;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Hide the visible label (still read by screen readers). */
  compact?: boolean;
  /** Show a "?" button (top bar). */
  helpButton?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle" data-control="toggle" data-help-id={helpId}>
      {compact ? (
        <label htmlFor={id} className="visually-hidden">
          {label}
        </label>
      ) : (
        <LabelTip helpId={helpId} htmlFor={id} className="toggle__label">
          {label}
        </LabelTip>
      )}
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
      {helpButton && <HelpTip id={helpId} />}
    </div>
  );
}
