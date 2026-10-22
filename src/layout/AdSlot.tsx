import { features } from '../config/features';

/**
 * Reserved advert space below the editor (DESIGN.md §8). Never covers the
 * tool. Renders nothing while the `ads` feature flag is off (version 1).
 */
export function AdSlot({ enabled = features.ads }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <aside className="ad-slot" aria-label="Advertisement" data-testid="ad-slot">
      <p className="ad-slot__notice">Ads help keep Token Maker free.</p>
      <div className="ad-slot__space" />
    </aside>
  );
}
