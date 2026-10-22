import { useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { AdSlot } from './AdSlot';
import { BottomBar } from './BottomBar';
import { BottomSheet } from './BottomSheet';
import { CanvasArea } from './CanvasArea';
import { Footer } from './Footer';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import type { SectionId } from './sections';

/**
 * The editor layout (DESIGN.md §8).
 * - Desktop (≥ 1024px) and tablet (768–1023px, narrower panel): canvas + right panel + bottom bar.
 * - Phone (< 768px): canvas on top, draggable bottom sheet with icon tabs.
 * The editor fills the screen; the ad slot and footer sit below it.
 */
export function AppShell() {
  const wide = useMediaQuery('(min-width: 768px)');
  const [open, setOpenSections] = useState<ReadonlySet<SectionId>>(() => new Set(['import']));
  const setOpen = (id: SectionId, isOpen: boolean) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(id);
      else next.delete(id);
      return next;
    });

  const goToExport = () => {
    setOpen('export', true);
    requestAnimationFrame(() => {
      const el = document.getElementById('section-export');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el?.querySelector<HTMLButtonElement>('.section__toggle')?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <div className={`editor ${wide ? 'editor--wide' : 'editor--phone'}`}>
        <TopBar compact={!wide} />
        <div className="editor__body">
          <CanvasArea />
          {wide ? <SidePanel openSections={open} setOpen={setOpen} /> : <BottomSheet />}
        </div>
        {wide && <BottomBar onExport={goToExport} />}
      </div>
      <AdSlot />
      <Footer />
    </>
  );
}
