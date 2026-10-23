import { LoaderCircle, X } from 'lucide-react';
import { cancelExport, useExportProgress } from '../editor/useExport';

/** A progress bar while an export is being made (a batch ZIP can take a while on a phone). */
export function ExportProgress() {
  const p = useExportProgress((s) => s);
  if (!p.busy) return null;
  const batch = p.total > 1;
  const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
  return (
    <div className="export-progress" role="status" aria-live="polite">
      <LoaderCircle size={18} className="spin" aria-hidden="true" />
      <div className="export-progress__body">
        <span className="export-progress__label">{p.label}</span>
        {batch && (
          <div className="export-progress__track" role="progressbar" aria-label="Export progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="export-progress__fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      {batch && (
        <button type="button" className="icon-btn" aria-label="Stop the export" title="Stop" onClick={cancelExport} disabled={p.cancelled}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}
