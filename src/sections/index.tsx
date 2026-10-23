import { lazy, Suspense, type ComponentType } from 'react';
import type { SectionId } from '../layout/sections';
import { ImportSection } from './ImportSection';

// Only the Import section, open at the start, comes with the first load.
// The others load in the background once the editor is up (Phase 10), so
// the first page is quicker and opening a section is still instant.
const loaders = {
  image: () => import('./ImageSection').then((m) => ({ default: m.ImageSection })),
  background: () => import('./BackgroundSection').then((m) => ({ default: m.BackgroundSection })),
  lighting: () => import('./LightingSection').then((m) => ({ default: m.LightingSection })),
  popout: () => import('./PopOutSection').then((m) => ({ default: m.PopOutSection })),
  effects: () => import('./EffectsSection').then((m) => ({ default: m.EffectsSection })),
  frame: () => import('./FrameSection').then((m) => ({ default: m.FrameSection })),
  decorations: () => import('./DecorationsSection').then((m) => ({ default: m.DecorationsSection })),
  size: () => import('./SizeSection').then((m) => ({ default: m.SizeSection })),
  label: () => import('./LabelSection').then((m) => ({ default: m.LabelSection })),
  presets: () => import('./PresetsSection').then((m) => ({ default: m.PresetsSection })),
  export: () => import('./ExportSection').then((m) => ({ default: m.ExportSection })),
} satisfies Partial<Record<SectionId, () => Promise<{ default: ComponentType }>>>;

function lazySection(load: () => Promise<{ default: ComponentType }>): ComponentType {
  const Content = lazy(load);
  return function LazySection() {
    return (
      <Suspense fallback={<p className="control__hint" role="status">Loading…</p>}>
        <Content />
      </Suspense>
    );
  };
}

/** Sections that have been built. Others show their placeholder. */
export const SECTION_CONTENT: Partial<Record<SectionId, ComponentType>> = {
  import: ImportSection,
  ...Object.fromEntries(Object.entries(loaders).map(([id, load]) => [id, lazySection(load)])),
};

let preloaded = false;
/** Fetches the other sections' code while the browser is idle. */
export function preloadSections(): void {
  if (preloaded) return;
  preloaded = true;
  const go = () => Object.values(loaders).forEach((load) => void load().catch(() => {}));
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}
