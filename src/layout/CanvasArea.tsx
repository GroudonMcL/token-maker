import { Stage } from '../editor/Stage';
import { useDoc } from '../state/tokenStore';
import { FloatingToolbar } from './FloatingToolbar';
import { PEEK_HEIGHT } from './BottomSheet';

/** The central canvas area: the stage and its floating toolbar. */
export function CanvasArea({ phone }: { phone: boolean }) {
  const hasArt = useDoc((d) => d.art.assetId !== null);
  return (
    <main className="canvas-area" aria-label="Token preview">
      <FloatingToolbar disabled={!hasArt} />
      <Stage reserveTop={64} reserveBottom={phone ? PEEK_HEIGHT : 0} />
    </main>
  );
}
