import { Download, FolderArchive } from 'lucide-react';
import { useBatch } from '../batch/batch';
import { exportMain, useExportProgress } from '../editor/useExport';
import { FORMATS } from '../export/formats';
import { useExportSettings } from '../export/exportSettings';
import { useDoc } from '../state/tokenStore';
import { TokenSummary } from './TokenSummary';

/** The main Export button: the token on screen, or every token of a batch as a ZIP. */
export function ExportButton({ short = false }: { short?: boolean }) {
  const hasArt = useDoc((d) => d.art.assetId !== null);
  const format = useExportSettings((s) => s.format);
  const busy = useExportProgress((p) => p.busy);
  const count = useBatch((b) => (b.on ? b.items.length : 0));
  const all = count > 1;
  const Icon = all ? FolderArchive : Download;
  return (
    <button type="button" className="btn btn--primary" onPointerDown={(e) => e.stopPropagation()} onClick={exportMain} disabled={!hasArt || busy}>
      <Icon size={18} aria-hidden="true" />
      {all ? `Export all (${count})` : short ? 'Export' : `Export ${FORMATS[format].label}`}
    </button>
  );
}

/** Desktop/tablet bottom bar: token summary and the Export button. */
export function BottomBar() {
  return (
    <footer className="bottom-bar">
      <TokenSummary />
      <ExportButton />
    </footer>
  );
}
