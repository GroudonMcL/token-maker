import type { ReactNode } from 'react';
import type { HelpId } from '../help/helpContent';
import { HelpTip } from './HelpTip';

/** The label row above a control: name, "?" tip, and an optional value on the right. */
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
      {htmlFor ? (
        <label htmlFor={htmlFor} id={id}>
          {label}
        </label>
      ) : (
        <span id={id}>{label}</span>
      )}
      {helpId && <HelpTip id={helpId} />}
      {aside !== undefined && <span className="control-label__aside">{aside}</span>}
    </div>
  );
}
