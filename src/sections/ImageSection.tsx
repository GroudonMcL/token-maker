import { Brush, Eraser, RotateCcw, Undo2 } from 'lucide-react';
import { Advanced, ControlLabel, SegmentedButtons, Slider, Toggle } from '../components';
import { DEFAULT_ADJUST } from '../document/defaults';
import type { ImageAdjustments } from '../document/types';
import { BRUSH_MAX, BRUSH_MIN, DEFAULTS as TOOL_DEFAULTS, setBrush, setTool, useTool } from '../editor/tools';
import type { HelpId } from '../help/helpContent';
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

function AdjustSlider({ def, value }: { def: AdjustDef; value: number }) {
  return (
    <Slider
      label={def.label}
      helpId={def.helpId}
      min={def.min}
      max={def.max}
      unit={def.unit}
      value={value}
      defaultValue={DEFAULT_ADJUST[def.key]}
      onChange={(v) => setAdjust({ [def.key]: v }, true)}
      onCommit={commitDoc}
    />
  );
}

/** Image section (DESIGN.md §6.2): adjustments and the erase/restore brush. Background removal is in the Background section (v8). */
export function ImageSection() {
  const hasArt = useDoc((d) => d.art.assetId !== null);
  if (!hasArt) return <p className="control__hint">Add an image first, then adjust it and tidy it with the brush here.</p>;
  return (
    <>
      <Adjustments />
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
        defaultValue={TOOL_DEFAULTS.brushSize}
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
          defaultValue={TOOL_DEFAULTS.brushSoftness}
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
