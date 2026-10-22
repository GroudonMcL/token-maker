import { Download } from 'lucide-react';
import { TokenSummary } from './TokenSummary';

/** Desktop/tablet bottom bar: token summary and the Export button. */
export function BottomBar({ onExport }: { onExport: () => void }) {
  return (
    <footer className="bottom-bar">
      <TokenSummary />
      <button type="button" className="btn btn--primary" onClick={onExport}>
        <Download size={18} aria-hidden="true" />
        Export
      </button>
    </footer>
  );
}
