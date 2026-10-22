import { Brush, Eraser, Pipette, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { Advanced, ControlLabel, SegmentedButtons, Slider, Toggle } from '../components';
import { DEFAULT_ADJUST } from '../document/defaults';
import type { BackgroundRemoval, ImageAdjustments } from '../document/types';
import { BRUSH_MAX, BRUSH_MIN, setBrush, setTool, useTool } from '../editor/tools';
import type { HelpId } from '../help/helpContent';
import { DRAFT_SIDE, sourcePixels } from '../image/processedArt';
import { detectEdgeColor } from '../image/removal';
import { toHex } from '../render/color';
import { assetStore } from '../state/assets';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';

type NumberKey = Exclude<keyof ImageAdjustments, 'invert'>;

interface AdjustDef {
  key: NumberKey;
  label: string;
  helpId: HelpId;
  min: number;
  max: number;
  unit?: string;
}

const MAIN: AdjustDef[] = [
  { key: 'brightness', label: 'Brightness', helpId: 'image.brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', helpId: 'image.contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', helpId: 'image.saturation', min: -100, max: 100 },
];

const GROUPS: { title: string; items: AdjustDef[] }[] = [
  {
    title: 'Colour',
    items: [
      { key: 'hue', label: 'Hue', helpId: 'image.hue', min: -180, max: 180, unit: '°' },
      { key: 'temperature', label: 'Temperature', helpId: 'image.temperature', min: -100, max: 100 },
      { key: 'tint', label: 'Tint', helpId: 'image.tint', min: -100, max: 100 },
    ],
  },
  {
    title: 'Light',
    items: [
      { key: 'exposure', label: 'Exposure', helpId: 'image.exposure', min: -100, max: 100 },
      { key: 'highlights', label: 'Highlights', helpId: 'image.highlights', min: -100, max: 100 },
      { key: 'shadows', label: 'Shadows', helpId: 'image.shadows', min: -100, max: 100 },
    ],
  },
  {
    title: 'Detail',
    items: [
      { key: 'sharpness', label: 'Sharpness', helpId: 'image.sharpness', min: 0, max: 100 },
      { key: 'blur', label: 'Blur', helpId: 'image.blur', min: 0, max: 100 },
    ],
  },
  {
    title: 'Style',
    items: [
      { key: 'vibrance', label: 'Vibrance', helpId: 'image.vibrance', min: -100, max: 100 },
      { key: 'grayscale', label: 'Grayscale', helpId: 'image.grayscale', min: 0, max: 100, unit: '%' },
      { key: 'sepia', label: 'Sepia', helpId: 'image.sepia', min: 0, max: 100, unit: '%' },
    ],
  },
];

const setAdjust = (patch: Partial<ImageAdjustments>, transient = false) =>
  updateDoc((d) => ({ ...d, art: { ...d.art, adjust: { ...d.art.adjust, ...patch } } }), { transient });

const setRemoval = (patch: Partial<BackgroundRemoval>, transient = false) =>
  updateDoc((d) => ({ ...d, art: { ...d.art, removal: { ...d.art.removal, ...patch } } }), { transient });

function AdjustSlider({ def, value }: { def: AdjustDef; value: number }) {
  return (
    <Slider
      label={def.label}
      helpId={def.helpId}
      min={def.min}
      max={def.max}
      unit={def.unit}
      value={value}
      onChange={(v) => setAdjust({ [def.key]: v }, true)}
      onCommit={commitDoc}
    />
  );
}

/** Image section (DESIGN.md §6.2): adjustments, flat background removal and the erase/restore brush. */
export function ImageSection() {
  const hasArt = useDoc((d) => d.art.assetId !== null);
  if (!hasArt) return <p className="control__hint">Add an image first, then adjust it and remove its background here.</p>;
  return (
    <>
      <Adjustments />
      <BackgroundRemovalControls />
      <BrushControls />
    </>
  );
}

function Adjustments() {
  const adjust = useDoc((d) => d.art.adjust);
  const changed = JSON.stringify(adjust) !== JSON.stringify(DEFAULT_ADJUST);
  return (
    <>
      {MAIN.map((def) => (
        <AdjustSlider key={def.key} def={def} value={adjust[def.key]} />
      ))}
      <Advanced helpId="image.advanced">
        {GROUPS.map((g) => (
          <div key={g.title} className="control-group">
            <h4 className="control-group__title">{g.title}</h4>
            {g.items.map((def) => (
              <AdjustSlider key={def.key} def={def} value={adjust[def.key]} />
            ))}
            {g.title === 'Style' && <Toggle label="Invert" helpId="image.invert" checked={adjust.invert} onChange={(v) => setAdjust({ invert: v })} />}
          </div>
        ))}
      </Advanced>
      <button type="button" className="btn btn--ghost btn--small" disabled={!changed} onClick={() => setAdjust({ ...DEFAULT_ADJUST })}>
        <RotateCcw size={16} aria-hidden="true" />
        Reset adjustments
      </button>
    </>
  );
}

function BackgroundRemovalControls() {
  const removal = useDoc((d) => d.art.removal);
  const assetId = useDoc((d) => d.art.assetId);
  const art = useStore(assetStore, (s) => (assetId ? s.assets.get(assetId) : undefined));
  const tool = useTool((s) => s.tool);
  const detected = useMemo(() => {
    if (!art) return null;
    const [r, g, b] = detectEdgeColor(sourcePixels(art, DRAFT_SIDE));
    return toHex({ r, g, b });
  }, [art]);
  const colour = removal.color ?? detected ?? '#ffffff';

  return (
    <div className="control-group">
      <h4 className="control-group__title">Background removal</h4>
      <Toggle label="Remove flat background" helpId="image.removeBg" checked={removal.enabled} onChange={(v) => setRemoval({ enabled: v })} />
      {removal.enabled && (
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
              <button
                type="button"
                className="btn"
                aria-pressed={tool === 'eyedropper'}
                onClick={() => setTool(tool === 'eyedropper' ? 'move' : 'eyedropper')}
              >
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
            min={0}
            max={100}
            value={removal.intensity}
            onChange={(v) => setRemoval({ intensity: v }, true)}
            onCommit={commitDoc}
          />
          <Slider
            label="Edge softness"
            helpId="image.softness"
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

function BrushControls() {
  const tool = useTool((s) => s.tool);
  const mode = useTool((s) => s.brushMode);
  const size = useTool((s) => s.brushSize);
  const softness = useTool((s) => s.brushSoftness);
  const usePressure = useTool((s) => s.usePressure);
  const showRemoved = useTool((s) => s.showRemoved);
  const strokeCount = useDoc((d) => d.art.strokes.length);
  const on = tool === 'brush';

  return (
    <div className="control-group">
      <h4 className="control-group__title">Erase / restore brush</h4>
      <div className="control" data-control="brush" data-help-id="image.brush">
        <ControlLabel label="Brush" helpId="image.brush" />
        <button type="button" className={`btn btn--wide${on ? ' btn--primary' : ''}`} aria-pressed={on} onClick={() => setTool(on ? 'move' : 'brush')}>
          <Brush size={18} aria-hidden="true" />
          {on ? 'Brush on: paint on the picture' : 'Use the brush'}
        </button>
      </div>
      <SegmentedButtons
        label="Brush does"
        helpId="image.brushMode"
        value={mode}
        onChange={(m) => setBrush({ brushMode: m })}
        options={[
          { value: 'erase', label: 'Erase', icon: <Eraser size={16} /> },
          { value: 'restore', label: 'Restore', icon: <Undo2 size={16} /> },
        ]}
      />
      <Slider
        label="Brush size"
        helpId="image.brushSize"
        unit="px"
        min={BRUSH_MIN}
        max={BRUSH_MAX}
        value={size}
        onChange={(v) => setBrush({ brushSize: v })}
      />
      <Advanced helpId="image.brushAdvanced">
        <Slider
          label="Softness"
          helpId="image.brushSoftness"
          unit="%"
          min={0}
          max={100}
          value={softness}
          onChange={(v) => setBrush({ brushSoftness: v })}
        />
        <Toggle label="Pen pressure" helpId="image.pressure" checked={usePressure} onChange={(v) => setBrush({ usePressure: v })} />
        <Toggle label="Show removed parts in red" helpId="image.showRemoved" checked={showRemoved} onChange={(v) => setBrush({ showRemoved: v })} />
      </Advanced>
      <button
        type="button"
        className="btn btn--ghost btn--small"
        disabled={!strokeCount}
        onClick={() => updateDoc((d) => ({ ...d, art: { ...d.art, strokes: [] } }))}
      >
        <RotateCcw size={16} aria-hidden="true" />
        Clear brush strokes
      </button>
    </div>
  );
}
