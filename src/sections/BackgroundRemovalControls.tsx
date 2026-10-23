import { Pipette, RefreshCw, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { ControlLabel, SegmentedButtons, Slider, Toggle } from '../components';
import { DEFAULT_REMOVAL } from '../document/defaults';
import type { BackgroundRemoval } from '../document/types';
import { setTool, useTool } from '../editor/tools';
import { forgetAiMask, runAiRemoval, useAiStatus, useHasAiMask } from '../image/aiRemoval';
import { DRAFT_SIDE, sourcePixels } from '../image/processedArt';
import { detectEdgeColor } from '../image/removal';
import { toHex } from '../render/color';
import type { RenderSource } from '../render/render';
import { assetStore } from '../state/assets';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';

const setRemoval = (patch: Partial<BackgroundRemoval>, transient = false) =>
  updateDoc((d) => ({ ...d, art: { ...d.art, removal: { ...d.art.removal, ...patch } } }), { transient });

const METHODS = [
  { value: 'colour', label: 'Flat colour' },
  { value: 'ai', label: 'AI' },
] as const;

/**
 * Background removal (DESIGN.md §6.2; in the Background section since v8):
 * a flat colour found from the edges or picked, or an AI cut-out made in the
 * browser. Either way it's a mask, so the picture itself never changes.
 */
export function BackgroundRemovalControls() {
  const removal = useDoc((d) => d.art.removal);
  const assetId = useDoc((d) => d.art.assetId);
  const art = useStore(assetStore, (s) => (assetId ? s.assets.get(assetId) : undefined));
  if (!assetId) return <p className="control__hint">Add an image first to remove its background.</p>;
  return (
    <div className="control-group">
      <h4 className="control-group__title">Background removal</h4>
      <Toggle label="Remove background" helpId="image.removeBg" checked={removal.enabled} onChange={(v) => setRemoval({ enabled: v })} />
      {removal.enabled && (
        <>
          <SegmentedButtons label="How" helpId="background.removeMethod" value={removal.method} options={METHODS} onChange={(method) => setRemoval({ method })} />
          {removal.method === 'colour' ? <FlatColour removal={removal} art={art} /> : <AiCutOut assetId={assetId} art={art} />}
          <Slider
            label="Edge softness"
            helpId="image.softness"
            defaultValue={DEFAULT_REMOVAL.softness}
            min={0}
            max={100}
            value={removal.softness}
            onChange={(v) => setRemoval({ softness: v }, true)}
            onCommit={commitDoc}
          />
        </>
      )}
    </div>
  );
}

function FlatColour({ removal, art }: { removal: BackgroundRemoval; art: RenderSource | undefined }) {
  const tool = useTool((s) => s.tool);
  const detected = useMemo(() => {
    if (!art) return null;
    const [r, g, b] = detectEdgeColor(sourcePixels(art, DRAFT_SIDE));
    return toHex({ r, g, b });
  }, [art]);
  const colour = removal.color ?? detected ?? '#ffffff';
  return (
    <>
      <div className="control" data-control="bg-colour" data-help-id="image.bgColour">
        <ControlLabel label="Background colour" helpId="image.bgColour" />
        <div className="bg-colour">
          <span className="bg-colour__swatch" style={{ background: colour }} aria-hidden="true" />
          <span className="bg-colour__text">
            {removal.color ? 'Picked' : 'Found from the edges'}
            <code>{colour}</code>
          </span>
        </div>
        <div className="button-row">
          <button type="button" className="btn" aria-pressed={tool === 'eyedropper'} onClick={() => setTool(tool === 'eyedropper' ? 'move' : 'eyedropper')}>
            <Pipette size={16} aria-hidden="true" />
            {tool === 'eyedropper' ? 'Tap the picture…' : 'Pick colour'}
          </button>
          <button type="button" className="btn" disabled={!removal.color} onClick={() => setRemoval({ color: null })}>
            <Sparkles size={16} aria-hidden="true" />
            Auto
          </button>
        </div>
      </div>
      <Slider
        label="Intensity"
        helpId="image.intensity"
        defaultValue={DEFAULT_REMOVAL.intensity}
        min={0}
        max={100}
        value={removal.intensity}
        onChange={(v) => setRemoval({ intensity: v }, true)}
        onCommit={commitDoc}
      />
      <Toggle label="Remove enclosed gaps too" helpId="image.enclosed" checked={removal.enclosed} onChange={(enclosed) => setRemoval({ enclosed })} />
    </>
  );
}

function AiCutOut({ assetId, art }: { assetId: string; art: RenderSource | undefined }) {
  const status = useAiStatus(assetId);
  const ready = useHasAiMask(assetId);
  const again = () => {
    if (!art) return;
    void forgetAiMask(assetId).then(() => runAiRemoval(assetId, art));
  };
  return (
    <div className="control" data-control="ai-removal" data-help-id="background.aiRemove">
      <ControlLabel label="AI cut-out" helpId="background.aiRemove" />
      {status?.state === 'working' ? (
        <>
          <p className="control__hint" role="status">
            {status.stage === 'download' ? `Downloading the AI model… ${Math.round(status.progress)}%` : 'Cutting out the picture…'}
          </p>
          <progress className="ai-progress" max={100} value={status.stage === 'download' ? status.progress : undefined} aria-label="AI cut-out progress" />
        </>
      ) : status?.state === 'error' ? (
        <p className="control__hint control__hint--error" role="alert">
          {status.message}
        </p>
      ) : ready ? (
        <p className="control__hint">Done. Tidy any edges with the erase/restore brush in the Image section.</p>
      ) : (
        <p className="control__hint">Works on any background. The first time, a 100 MB AI model downloads; your picture never leaves this device.</p>
      )}
      {status?.state !== 'working' && (
        <button type="button" className="btn btn--small" disabled={!art} onClick={again}>
          <RefreshCw size={14} aria-hidden="true" />
          {status?.state === 'error' ? 'Try again' : ready ? 'Cut out again' : 'Cut out now'}
        </button>
      )}
    </div>
  );
}
