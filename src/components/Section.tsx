import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { HelpId } from '../help/helpContent';
import { useMenuStyle } from '../state/menuStyle';
import { HelpTip } from './HelpTip';

/**
 * A collapsible panel section with a "?" tip. Anything passed as `advanced`
 * goes in a nested "Advanced" drop-down, closed by default, so the simple
 * view stays simple (DESIGN.md §1).
 */
export function Section({
  title,
  helpId,
  icon,
  defaultOpen = false,
  advanced,
  advancedHelpId = 'kit.advanced',
  children,
  id,
  open: openProp,
  onOpenChange,
}: {
  title: string;
  helpId: HelpId;
  icon?: ReactNode;
  defaultOpen?: boolean;
  advanced?: ReactNode;
  advancedHelpId?: HelpId;
  children?: ReactNode;
  id?: string;
  /** Pass `open` + `onOpenChange` to control it from outside. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const bodyId = useId();
  return (
    <section className="section" data-open={open} data-control="section" data-help-id={helpId} id={id}>
      <div className="section__header">
        <button
          type="button"
          className="section__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          {icon && <span className="section__icon" aria-hidden="true">{icon}</span>}
          <span className="section__title">{title}</span>
          <ChevronDown className="section__chevron" aria-hidden="true" size={18} />
        </button>
        <HelpTip id={helpId} />
      </div>
      <div className="section__body" id={bodyId} hidden={!open}>
        {children}
        {advanced && <Advanced helpId={advancedHelpId}>{advanced}</Advanced>}
      </div>
    </section>
  );
}

/**
 * The "Advanced" drop-down. The menu style decides how it shows: hidden
 * entirely (Simple), a closed drop-down (Advanced) or always open with no
 * drop-down (Expert).
 */
export function Advanced({ helpId = 'kit.advanced', children }: { helpId?: HelpId; children: ReactNode }) {
  const style = useMenuStyle();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (style === 'simple') return null;
  if (style === 'expert') {
    return (
      <div className="advanced advanced--expert" data-control="advanced" data-help-id={helpId}>
        {children}
      </div>
    );
  }
  return (
    <div className="advanced" data-open={open} data-control="advanced" data-help-id={helpId}>
      <div className="advanced__header">
        <button
          type="button"
          className="advanced__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown className="advanced__chevron" aria-hidden="true" size={16} />
          Advanced
        </button>
      </div>
      <div className="advanced__body" id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
