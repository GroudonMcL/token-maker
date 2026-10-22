import { Download } from 'lucide-react';
import { ControlLabel } from '../components';
import { exportCurrentToken } from '../editor/useExport';
import { outputSize } from '../document/sizing';
import { useDoc } from '../state/tokenStore';

/** Export section (temporary, Phase 1): a PNG at 256 px per square. Full panel in Phase 9. */
export function ExportSection() {
  const squares = useDoc((d) => d.size.squares);
  const hasArt = useDoc((d) => d.art.assetId !== null);
  const px = outputSize(squares);
  return (
    <div className="control" data-control="download" data-help-id="export.download">
      <ControlLabel label="PNG with transparent background" helpId="export.download" />
      <button type="button" className="btn btn--primary btn--wide" onClick={exportCurrentToken} disabled={!hasArt}>
        <Download size={18} aria-hidden="true" />
        Download PNG
      </button>
      <p className="control__hint">
        <span className="num">
          {px} × {px} px
        </span>{' '}
        · more formats and sizes are coming.
      </p>
    </div>
  );
}
