import { BATCH_STRIP_HEIGHT, BatchStrip } from '../batch/BatchStrip';
import { useBatch } from '../batch/batch';
import { Stage } from '../editor/Stage';
import { useDoc } from '../state/tokenStore';
import { FloatingToolbar } from './FloatingToolbar';
import { useSheetCover } from './sheetCover';

/** The central canvas area: the stage, its floating toolbar and, in batch mode, the strip of tokens. */
export function CanvasArea({ phone }: { phone: boolean }) {
  const hasArt = useDoc((d) => d.art.assetId !== null);
  const batch = useBatch((b) => b.on);
  const cover = useSheetCover();
  const sheet = phone ? cover : 0;
  return (
    <main className="canvas-area" aria-label="Token preview">
      <FloatingToolbar disabled={!hasArt} />
      {/* On phones the strip sits under the toolbar, so the bottom sheet never covers it. */}
      <Stage reserveTop={64 + (batch && phone ? BATCH_STRIP_HEIGHT : 0)} reserveBottom={sheet + (batch && !phone ? BATCH_STRIP_HEIGHT : 0)} />
      {batch && <BatchStrip place={phone ? { top: 64 } : { bottom: 0 }} />}
    </main>
  );
}
