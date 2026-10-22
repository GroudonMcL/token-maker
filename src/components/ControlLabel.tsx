import type { ReactNode } from 'react';
import type { HelpId } from '../help/helpContent';
import { LabelTip } from './LabelTip';

/**
 * The label row above a control: its name and an optional value on the right.
 * Only section headings get a "?" button; a control's help card opens when
 * you hover its name (or long-press it on a touch screen).
 */
export function ControlLabel({
  htmlFor,
  id,
  label,
  helpId,
  aside,
}: {
  htmlFor?: string;
  id?: string;
  label: string;
  helpId?: HelpId;
  aside?: ReactNode;
}) {
  return (
    <div className="control-label">
      {helpId ? (
        <LabelTip helpId={helpId} htmlFor={htmlFor} id={id}>
          {label}
        </LabelTip>
      ) : htmlFor ? (
        <label htmlFor={htmlFor} id={id}>
          {label}
        </label>
      ) : (
        <span id={id}>{label}</span>
      )}
      {aside !== undefined && <span className="control-label__aside">{aside}</span>}
    </div>
  );
}
