import type { SectionId } from './sections';

const EVENT = 'token-maker:reveal-section';

/** Asks the layout to show a section: opens it on desktop, switches tab on phones. */
export function revealSection(id: SectionId): void {
  window.dispatchEvent(new CustomEvent<SectionId>(EVENT, { detail: id }));
}

/** Calls `onReveal` whenever a section asks to be shown; returns the unsubscribe function. */
export function onRevealSection(onReveal: (id: SectionId) => void): () => void {
  const listener = (e: Event) => onReveal((e as CustomEvent<SectionId>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
