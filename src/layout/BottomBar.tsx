import { Download } from 'lucide-react';
import { exportCurrentToken } from '../editor/useExport';
import { useDoc } from '../state/tokenStore';
import { TokenSummary } from './TokenSummary';

/** Desktop/tablet bottom bar: token summary and the Export button. */
export function BottomBar() {
  const hasArt = useDoc((d) => d.art.assetId !== null);
  return (
    <footer className="bottom-bar">
      <TokenSummary />
      <button type="button" className="btn btn--primary" onClick={exportCurrentToken} disabled={!hasArt}>
        <Download size={18} aria-hidden="true" />
        Export PNG
      </button>
    </footer>
  );
}
