import { useEffect, useRef } from 'react';
import { Section } from '../components';
import { SECTIONS, type SectionId } from './sections';
import { MenuStyleSwitch } from './MenuStyleSwitch';
import { SectionPlaceholder } from './SectionPlaceholder';
import { SECTION_CONTENT } from '../sections';

/** Desktop/tablet right-hand panel: every section, collapsible, in DESIGN.md §8 order. */
export function SidePanel({
  openSections,
  setOpen,
}: {
  openSections: ReadonlySet<SectionId>;
  setOpen: (id: SectionId, open: boolean) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const opened = [...openSections][0];
  // The sections above it may have just closed, so bring the opened one into view.
  useEffect(() => {
    if (opened) ref.current?.querySelector(`#section-${opened}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [opened]);
  return (
    <aside ref={ref} className="side-panel" aria-label="Token settings">
      <MenuStyleSwitch />
      {SECTIONS.map((s) => {
        const Content = SECTION_CONTENT[s.id];
        return (
        <Section
          key={s.id}
          id={`section-${s.id}`}
          title={s.title}
          helpId={s.helpId}
          icon={s.icon}
          open={openSections.has(s.id)}
          onOpenChange={(o) => setOpen(s.id, o)}
        >
          {Content ? <Content /> : <SectionPlaceholder text={s.placeholder} />}
        </Section>
        );
      })}
    </aside>
  );
}
