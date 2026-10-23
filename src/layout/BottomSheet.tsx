import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Section } from '../components';
import { selectDecoration, toolStore } from '../editor/tools';
import { onRevealSection } from './reveal';
import { PHONE_TABS, sectionById } from './sections';
import { MenuStyleSwitch } from './MenuStyleSwitch';
import { SectionPlaceholder } from './SectionPlaceholder';
import { SECTION_CONTENT } from '../sections';
import { ExportButton } from './BottomBar';
import { TokenSummary } from './TokenSummary';

export type SheetSnap = 'peek' | 'half' | 'full';
const ORDER: SheetSnap[] = ['peek', 'half', 'full'];
import { PEEK_HEIGHT, useSheetCover } from './sheetCover';

export { PEEK_HEIGHT };

function snapHeight(snap: SheetSnap, container: number) {
  if (snap === 'peek') return PEEK_HEIGHT;
  if (snap === 'half') return Math.max(PEEK_HEIGHT, Math.round(container * 0.5));
  return Math.max(PEEK_HEIGHT, Math.round(container * 0.88));
}

/**
 * Phone bottom sheet (DESIGN.md §8): drag the handle up/down (or tap it, or
 * use arrow keys) to resize; icon tabs switch between sections.
 */
export function BottomSheet() {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState(800);
  const [snap, setSnap] = useState<SheetSnap>('peek');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [tab, setTab] = useState(PHONE_TABS[0]!.id);
  // Tabs holding more than one section open one at a time, starting with the first.
  const [openSection, setOpenSection] = useState<string | null>(PHONE_TABS[0]!.sections[0]!);
  // Leaving the Decorations section lets go of the picked decoration, so the art's handles come back.
  useEffect(() => {
    if (openSection !== 'decorations') selectDecoration(null);
  }, [openSection]);
  const drag = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);
  const panelId = useId();

  // Track the editor height so snap points stay proportional.
  useLayoutEffect(() => {
    const parent = sheetRef.current?.parentElement;
    if (!parent) return;
    const update = () => setContainer(parent.clientHeight || window.innerHeight);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(parent);
    return () => ro?.disconnect();
  }, []);

  const height = dragHeight ?? snapHeight(snap, container);
  // A full-height sheet covers the canvas anyway: keep the token where a half sheet leaves it.
  useEffect(() => useSheetCover.setState(snapHeight(snap === 'full' ? 'half' : snap, container), true), [snap, container]);
  useEffect(() => () => useSheetCover.setState(PEEK_HEIGHT, true), []);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startH: height, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    const max = snapHeight('full', container);
    setDragHeight(Math.min(max, Math.max(PEEK_HEIGHT - 40, d.startH - dy)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setSnap(snap === 'peek' ? 'half' : 'peek'); // a tap toggles open/closed
      return;
    }
    const h = dragHeight ?? height;
    const nearest = ORDER.reduce((best, s) =>
      Math.abs(snapHeight(s, container) - h) < Math.abs(snapHeight(best, container) - h) ? s : best,
    );
    setSnap(nearest);
    setDragHeight(null);
  };
  const onHandleKey = (e: KeyboardEvent) => {
    const i = ORDER.indexOf(snap);
    if (e.key === 'ArrowUp') setSnap(ORDER[Math.min(2, i + 1)]!);
    else if (e.key === 'ArrowDown') setSnap(ORDER[Math.max(0, i - 1)]!);
    else return;
    e.preventDefault();
  };

  const chooseTab = (id: string) => {
    setTab(id);
    setOpenSection(PHONE_TABS.find((t) => t.id === id)!.sections[0]!);
    if (snap === 'peek') setSnap('half');
  };

  // A section asked to be shown (e.g. pictures found on a pasted page link).
  useEffect(
    () =>
      onRevealSection((id) => {
        const t = PHONE_TABS.find((p) => p.sections.includes(id));
        if (!t) return;
        setTab(t.id);
        setSnap((s) => (s === 'peek' ? 'half' : s));
      }),
    [],
  );

  // The brush and eyedropper need the picture: lower the sheet while they're on, then put it back.
  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  useEffect(() => {
    let before: SheetSnap | null = null;
    return toolStore.subscribe((state, prev) => {
      if (state.tool === prev.tool) return;
      if (prev.tool === 'move') {
        before = snapRef.current;
        setSnap('peek');
      } else if (state.tool === 'move' && before) {
        setSnap(before);
        before = null;
      }
    });
  }, []);

  // Keep the active tab button visible in the scrolling tab row.
  useEffect(() => {
    sheetRef.current?.querySelector(`[data-tab="${tab}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  const active = PHONE_TABS.find((t) => t.id === tab)!;

  return (
    <div
      ref={sheetRef}
      className="bottom-sheet"
      data-snap={snap}
      data-dragging={dragHeight !== null || undefined}
      style={{ height }}
    >
      <div className="bottom-sheet__grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <button
          type="button"
          className="bottom-sheet__handle"
          aria-label={snap === 'peek' ? 'Open settings panel' : 'Resize settings panel'}
          aria-expanded={snap !== 'peek'}
          aria-controls={panelId}
          onKeyDown={onHandleKey}
          onClick={(e) => {
            // Pointer taps are handled in onPointerUp; this handles Enter/Space.
            if (e.detail === 0) setSnap(snap === 'peek' ? 'half' : 'peek');
          }}
        >
          <span className="bottom-sheet__bar" />
        </button>
        <div className="bottom-sheet__summary">
          <TokenSummary />
          <ExportButton short />
        </div>
      </div>
      <div className="bottom-sheet__tabs" role="tablist" aria-label="Settings">
        {PHONE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab={t.id}
            className="bottom-sheet__tab"
            aria-selected={t.id === tab}
            aria-controls={panelId}
            onClick={() => chooseTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="bottom-sheet__content" id={panelId} role="tabpanel" aria-label={active.label} hidden={snap === 'peek' && dragHeight === null}>
        {active.id === 'import' && <MenuStyleSwitch />}
        {active.sections.map((sid) => {
          const s = sectionById(sid);
          const Content = SECTION_CONTENT[sid];
          return (
            <Section
              key={sid}
              title={s.title}
              helpId={s.helpId}
              icon={s.icon}
              open={openSection === sid}
              onOpenChange={(o) => setOpenSection(o ? sid : null)}
            >
              {Content ? <Content /> : <SectionPlaceholder text={s.placeholder} />}
            </Section>
          );
        })}
      </div>
    </div>
  );
}
