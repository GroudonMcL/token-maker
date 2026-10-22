import { Eraser, Paintbrush, Pipette, RotateCcw, Trash2, Wand2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { Advanced, ControlLabel, Slider, Toggle } from '../components';
import { DEFAULT_ADJUST, DEFAULT_REMOVAL } from '../document/defaults';
import type { BackgroundRemoval, ImageAdjustments } from '../document/types';
import type { HelpId } from '../help/helpContent';
import { detectedBackground } from '../image/processArt';
import { assetStore } from '../state/assets';
import { BRUSH_MAX, BRUSH_MIN, DEFAULT_BRUSH, setBrush, setTool, useTool } from '../state/toolStore';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';

type NumericAdjustment = Exclude<keyof ImageAdjustments, 'invert'>;

interface AdjustDef {
  key: NumericAdjustment;
  label: string;
  min: number;
  max: number;
  unit?: string;
}

const MAIN: AdjustDef[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
];

const ADVANCED: { group: string; items: AdjustDef[] }[] = [
  {
    group: 'Colour',
    items: [
      { key: 'hue', label: 'Hue', min: -180, max: 180, unit: '°' },
      { key: 'temperature', label: 'Temperature', min: -100, max: 100 },
      { key: 'tint', label: 'Tint', min: -100, max: 100 },
    ],
  },
  {
    group: 'Light',
    items: [
      { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
      { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
      { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
    ],
  },
  {
    group: 'Detail',
    items: [
      { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
      { key: 'blur', label: 'Blur', min: 0, max: 100 },
    ],
  },
  {
    group: 'Style',
    items: [
      { key: 'vibrance', label: 'Vibrance', min: -100, max: 100 },
      { key: 'grayscale', label: 'Grayscale', min: 0, max: 100 },
      { key: 'sepia', label: 'Sepia', min: 0, max: 100 },
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
      helpId={`image.${def.key}` as HelpId}
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="control-group">
      <h4 className="control-group__title">{title}</h4>
      {children}
    </div>
  );
}

/** Image section (DESIGN.md §6.2): adjustments, background removal and the erase/restore brush. */
export function ImageSection() {
  const adjust = useDoc((d) => d.art.adjust);
  const removal = useDoc((d) => d.art.removal);
  const strokeCount = useDoc((d) => d.art.strokes.length);
  const assetId = useDoc((d) => d.art.assetId);
  const art = useStore(assetStore, (s) => (assetId ? s.assets.get(assetId) : undefined));
  const tool = useTool((s) => s.tool);
  const brush = useTool((s) => s.brush);
  const autoColor = useMemo(() => (art ? detectedBackground(art, removal.intensity) : null), [art, removal.intensity]);
  const changed = JSON.stringify(adjust) !== JSON.stringify(DEFAULT_ADJUST);
  const shownColor = removal.color ?? autoColor;

  const toggleTool = (t: 'erase' | 'restore' | 'pick') => setTool(tool === t ? 'move' : t);

  return (
    <>
      {MAIN.map((def) => (
        <AdjustSlider key={def.key} def={def} value={adjust[def.key]} />
      ))}
      <Advanced>
        {ADVANCED.map((g) => (
          <Group key={g.group} title={g.group}>
            {g.items.map((def) => (
              <AdjustSlider key={def.key} def={def} value={adjust[def.key]} />
            ))}
            {g.group === 'Style' && <Toggle label="Invert" helpId="image.invert" checked={adjust.invert} onChange={(v) => setAdjust({ invert: v })} />}
          </Group>
        ))}
      </Advanced>
      <button
        type="button"
        className="btn btn--ghost btn--small"
        data-control="button"
        data-help-id="image.reset"
        disabled={!changed}
        onClick={() => setAdjust(DEFAULT_ADJUST)}
      >
        <RotateCcw size={14} aria-hidden="true" />
        Reset adjustments
      </button>

      <Group title="Background removal">
        <Toggle label="Remove background" helpId="removal.enabled" checked={removal.enabled} onChange={(v) => setRemoval({ enabled: v })} />
        {removal.enabled && (
          <>
            <div className="control" data-control="removal-color" data-help-id="removal.color">
              <ControlLabel label="Background colour" helpId="removal.color" />
              <div className="removal-color">
                <span className="removal-color__chip" style={{ background: shownColor ?? 'transparent' }} aria-hidden="true" />
                <span className="removal-color__text">
                  {removal.color ? 'Picked' : 'Auto'} <span className="num">{shownColor ?? ''}</span>
                </span>
                {removal.color && (
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => setRemoval({ color: null, seed: null })}>
                    <Wand2 size={14} aria-hidden="true" />
                    Auto
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--small"
                  aria-pressed={tool === 'pick'}
                  disabled={!art}
                  onClick={() => toggleTool('pick')}
                >
                  <Pipette size={14} aria-hidden="true" />
                  Pick
                </button>
              </div>
            </div>
            <Slider
              label="Intensity"
              helpId="removal.intensity"
              min={0}
              max={100}
              value={removal.intensity}
              defaultValue={DEFAULT_REMOVAL.intensity}
              onChange={(v) => setRemoval({ intensity: v }, true)}
              onCommit={commitDoc}
            />
            <Slider
              label="Edge softness"
              helpId="removal.softness"
              min={0}
              max={100}
              value={removal.softness}
              defaultValue={DEFAULT_REMOVAL.softness}
              onChange={(v) => setRemoval({ softness: v }, true)}
              onCommit={commitDoc}
            />
          </>
        )}
      </Group>

      <Group title="Erase / restore brush">
        <div className="control" data-control="brush" data-help-id="brush.tool">
          <ControlLabel label="Brush" helpId="brush.tool" />
          <div className="tool-buttons">
            <button type="button" className="btn" aria-pressed={tool === 'erase'} disabled={!art} onClick={() => toggleTool('erase')}>
              <Eraser size={16} aria-hidden="true" />
              Erase
            </button>
            <button type="button" className="btn" aria-pressed={tool === 'restore'} disabled={!art} onClick={() => toggleTool('restore')}>
              <Paintbrush size={16} aria-hidden="true" />
              Restore
            </button>
          </div>
          {!art && <p className="control__hint">Import an image to use the brush.</p>}
        </div>
        <Slider
          label="Brush size"
          helpId="brush.size"
          unit="px"
          min={BRUSH_MIN}
          max={BRUSH_MAX}
          value={Math.round(brush.size)}
          defaultValue={DEFAULT_BRUSH.size}
          onChange={(v) => setBrush({ size: v })}
        />
        {!brush.simple && (
          <Slider
            label="Brush softness"
            helpId="brush.softness"
            unit="%"
            min={0}
            max={100}
            value={brush.softness}
            defaultValue={DEFAULT_BRUSH.softness}
            onChange={(v) => setBrush({ softness: v })}
          />
        )}
        <Toggle label="Simple brush" helpId="brush.simple" checked={brush.simple} onChange={(v) => setBrush({ simple: v })} />
        <p className="control__hint">Scroll over the token, or pinch with two fingers, to zoom in for detail.</p>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          data-control="button"
          data-help-id="brush.clear"
          disabled={strokeCount === 0}
          onClick={() => updateDoc((d) => ({ ...d, art: { ...d.art, strokes: [] } }))}
        >
          <Trash2 size={14} aria-hidden="true" />
          Clear brush strokes
        </button>
      </Group>
    </>
  );
}
