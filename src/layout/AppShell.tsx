import { useEffect, useState } from 'react';
import { useBatch } from '../batch/batch';
import { selectDecoration } from '../editor/tools';
import { useGlobalImport } from '../editor/useGlobalImport';
import { useShortcuts } from '../editor/useShortcuts';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { restore, startAutosave } from '../state/autosave';
import { watchFrameImages } from '../state/frameLibrary';
import { watchLabelFonts } from '../fonts/fontLoader';
import { watchLibraryImages } from '../state/libraryAssets';
import { preloadSections } from '../sections';
import { Toasts } from '../ui/Toasts';
import { AdSlot } from './AdSlot';
import { BottomBar } from './BottomBar';
import { BottomSheet } from './BottomSheet';
import { CanvasArea } from './CanvasArea';
import { ExportProgress } from './ExportProgress';
import { Footer } from './Footer';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import { onRevealSection } from './reveal';
import type { SectionId } from './sections';

let booted = false;
/** Restores the autosaved token once, then keeps saving. */
function boot() {
  if (booted) return;
  booted = true;
  void restore().finally(() => {
    startAutosave();
    watchLibraryImages();
    watchFrameImages();
    watchLabelFonts();
    preloadSections();
  });
}

/**
 * The editor layout (DESIGN.md §8).
 * - Desktop (≥ 1024px) and tablet (768–1023px, narrower panel): canvas + right panel + bottom bar.
 * - Phone (< 768px): canvas on top, draggable bottom sheet with icon tabs.
 * The editor fills the screen; the ad slot and footer sit below it.
 */
export function AppShell() {
  const wide = useMediaQuery('(min-width: 768px)');
  const [open, setOpenSections] = useState<ReadonlySet<SectionId>>(() => new Set(['import']));
  const dropping = useGlobalImport();
  const batch = useBatch((b) => b.on);
  useShortcuts();
  useEffect(boot, []);
  useEffect(
    () =>
      onRevealSection((id) => {
        setOpenSections((prev) => (prev.has(id) ? prev : new Set([...prev, id])));
        requestAnimationFrame(() => document.getElementById(`section-${id}`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
      }),
    [],
  );

  // Leaving the Decorations section lets go of the picked decoration, so the art's handles come back.
  useEffect(() => {
    if (!open.has('decorations')) selectDecoration(null);
  }, [open]);

  // One section open at a time: opening one closes the rest, so the panel stays short.
  const setOpen = (id: SectionId, isOpen: boolean) => setOpenSections(isOpen ? new Set([id]) : new Set());

  return (
    <>
      <div className={`editor ${wide ? 'editor--wide' : 'editor--phone'}`}>
        <TopBar compact={!wide} />
        <div className="editor__body">
          <CanvasArea phone={!wide} />
          {wide ? <SidePanel openSections={open} setOpen={setOpen} /> : <BottomSheet />}
        </div>
        {wide && <BottomBar />}
        {dropping && (
          <div className="drop-overlay" aria-hidden="true">
            <p>{batch ? 'Drop the pictures to add them to the batch' : 'Drop the image to use it'}</p>
          </div>
        )}
      </div>
      <ExportProgress />
      <Toasts />
      <AdSlot />
      <Footer />
    </>
  );
}
