import { ClipboardCopy, Download, FolderArchive } from 'lucide-react';
import { useId, useState } from 'react';
import { Advanced, ControlLabel, SegmentedButtons, Slider } from '../components';
import { useBatch } from '../batch/batch';
import { DEFAULT_PX_PER_SQUARE } from '../document/sizing';
import { copyCurrentToken, exportAllTokens, exportCurrentToken, useExportProgress } from '../editor/useExport';
import { canCopyImages } from '../export/exportToken';
import { baseNameFor, clampPx, DEFAULT_EXPORT, safeBaseName, setExportSettings, useExportSettings } from '../export/exportSettings';
import { FORMAT_IDS, FORMATS, MAX_CUSTOM_PX, MIN_CUSTOM_PX, PX_PRESETS, finalSize, type ExportFormat } from '../export/formats';
import { useDoc } from '../state/tokenStore';

type PxChoice = `${(typeof PX_PRESETS)[number]}` | 'custom';

/** Export section (DESIGN.md §6.11): format, resolution, file name, download, copy and the batch ZIP. */
export function ExportSection() {
  const squares = useDoc((d) => d.size.squares);
  const name = useDoc((d) => d.name);
  const hasArt = useDoc((d) => d.art.assetId !== null);
  const s = useExportSettings((x) => x);
  const busy = useExportProgress((p) => p.busy);
  const batchOn = useBatch((b) => b.on);
  const batchCount = useBatch((b) => b.items.length);
  const info = FORMATS[s.format];
  const { side, capped } = finalSize(squares, s.pxPerSquare);
  // "Custom" stays chosen while typing a number that happens to match a preset.
  const [customPicked, setCustomPicked] = useState(false);
  const isPreset = !customPicked && (PX_PRESETS as readonly number[]).includes(s.pxPerSquare);
  const pxChoice: PxChoice = isPreset ? (String(s.pxPerSquare) as PxChoice) : 'custom';
  const fileId = useId();
  const typed = s.fileName && s.fileName.forName === name ? s.fileName.text : null;

  return (
    <>
      <SegmentedButtons
        label="Format"
        helpId="export.format"
        value={s.format}
        onChange={(format: ExportFormat) => setExportSettings({ format })}
        options={FORMAT_IDS.map((f) => ({ value: f, label: FORMATS[f].label }))}
      />
      <p className="control__hint">
        {s.format === 'png' && 'Lossless, with a see-through background. Works in every VTT.'}
        {s.format === 'webp' && 'See-through like PNG, but a much smaller file.'}
      </p>

      <SegmentedButtons
        label="Pixels per square"
        helpId="export.resolution"
        value={pxChoice}
        onChange={(v: PxChoice) => {
          setCustomPicked(v === 'custom');
          if (v !== 'custom') setExportSettings({ pxPerSquare: Number(v) });
        }}
        options={[...PX_PRESETS.map((p) => ({ value: String(p) as PxChoice, label: String(p) })), { value: 'custom' as const, label: 'Custom' }]}
      />
      {pxChoice === 'custom' && (
        <Slider
          label="Custom pixels per square"
          helpId="export.customPx"
          min={MIN_CUSTOM_PX}
          max={MAX_CUSTOM_PX}
          step={1}
          unit=" px"
          defaultValue={DEFAULT_PX_PER_SQUARE}
          value={s.pxPerSquare}
          onChange={(v) => setExportSettings({ pxPerSquare: clampPx(v) })}
        />
      )}
      <p className="control__hint" data-testid="export-size">
        Final size{' '}
        <span className="num">
          {side} × {side} px
        </span>
        {capped ? ` — capped at the largest size, ${side} px.` : '.'}
      </p>

      <div className="control" data-control="file-name" data-help-id="export.fileName">
        <ControlLabel htmlFor={fileId} label="File name" helpId="export.fileName" />
        <div className="file-name">
          <input
            id={fileId}
            className="text-input"
            type="text"
            maxLength={80}
            spellCheck={false}
            value={typed ?? baseNameFor(name, { fileName: null })}
            onChange={(e) => setExportSettings({ fileName: { text: e.target.value.replace(/[^\p{L}\p{N} _-]+/gu, ''), forName: name } })}
            onBlur={() => typed !== null && setExportSettings({ fileName: { text: safeBaseName(typed), forName: name } })}
          />
          <span className="file-name__ext num">.{info.ext}</span>
        </div>
      </div>

      <div className="export-actions">
        <button type="button" className="btn btn--primary btn--wide" onClick={exportCurrentToken} disabled={!hasArt || busy}>
          <Download size={18} aria-hidden="true" />
          Download {info.label}
        </button>
        <div data-control="copy" data-help-id="export.copy">
          <button type="button" className="btn btn--wide" onClick={copyCurrentToken} disabled={!hasArt || busy}>
            <ClipboardCopy size={18} aria-hidden="true" />
            Copy to clipboard
          </button>
          {!canCopyImages() && <p className="control__hint">This browser can&apos;t copy pictures; use Download instead.</p>}
        </div>
        {batchOn && (
          <div data-control="export-all" data-help-id="export.all">
            <button type="button" className="btn btn--primary btn--wide" onClick={exportAllTokens} disabled={!batchCount || busy}>
              <FolderArchive size={18} aria-hidden="true" />
              Export all as ZIP ({batchCount})
            </button>
          </div>
        )}
      </div>

      {info.lossy && (
        <Advanced helpId="export.advanced">
          <Slider
            label="Quality"
            helpId="export.quality"
            min={1}
            max={100}
            unit="%"
            defaultValue={DEFAULT_EXPORT.quality}
            value={s.quality}
            onChange={(quality) => setExportSettings({ quality })}
          />
        </Advanced>
      )}
    </>
  );
}
