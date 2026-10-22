import type { ReactNode } from 'react';
import type { HelpId } from '../help/helpContent';
import { getHelp } from '../help/helpContent';

/**
 * The label row above a control: its name and an optional value on the right.
 * Only section headings get a "?" button; a control's help text shows as a
 * tooltip when you hover its name.
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
  const tip = helpId ? getHelp(helpId).text : undefined;
  return (
    <div className="control-label">
      {htmlFor ? (
        <label htmlFor={htmlFor} id={id} title={tip}>
          {label}
        </label>
      ) : (
        <span id={id} title={tip}>
          {label}
        </span>
      )}
      {aside !== undefined && <span className="control-label__aside">{aside}</span>}
    </div>
  );
}
