import { Section } from '../components';
import { SECTIONS, type SectionId } from './sections';
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
  return (
    <aside className="side-panel" aria-label="Token settings">
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
