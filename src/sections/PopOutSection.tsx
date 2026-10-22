import { Eraser, Paintbrush, RotateCcw } from 'lucide-react';
import { Advanced, ControlLabel, SegmentedButtons, Slider, Toggle } from '../components';
import type { PopOutSettings } from '../document/types';
import { BRUSH_MAX, BRUSH_MIN, DEFAULTS as TOOL_DEFAULTS, setBrush, setTool, useTool } from '../editor/tools';
import { updateDoc, useDoc } from '../state/tokenStore';

const setPopOut = (patch: Partial<PopOutSettings>) => updateDoc((d) => ({ ...d, art: { ...d.art, popOut: { ...d.art.popOut, ...patch } } }));

/**
 * Pop-out section (DESIGN.md §6.6): paint the parts of the art (horns, a
 * head, a sword) that are drawn over the border. The brush shares its size,
 * softness and pen pressure with the Image section's erase/restore brush.
 */
export function PopOutSection() {
  const hasArt = useDoc((d) => d.art.assetId !== null);
  const popOut = useDoc((d) => d.art.popOut);
  const tool = useTool((s) => s.tool);
  const mode = useTool((s) => s.popOutMode);
  const size = useTool((s) => s.brushSize);
  const softness = useTool((s) => s.brushSoftness);
  const usePressure = useTool((s) => s.usePressure);
  const showMask = useTool((s) => s.showPopOut);
  if (!hasArt) return <p className="control__hint">Add an image first, then paint the parts that should break over the border.</p>;
  const on = tool === 'popout';

  return (
    <>
      <p className="control__hint">
        Zoom or move the art so the horns, head or weapon reach over the frame, then paint over them. Removing the background first keeps it from popping out too.
      </p>
      <div className="control" data-control="popout-brush" data-help-id="popout.brush">
        <ControlLabel label="Pop-out brush" helpId="popout.brush" />
        <button type="button" className={`btn btn--wide${on ? ' btn--primary' : ''}`} aria-pressed={on} onClick={() => setTool(on ? 'move' : 'popout')}>
          <Paintbrush size={18} aria-hidden="true" />
          {on ? 'Painting: paint over the parts to pop out' : 'Paint pop-out'}
        </button>
      </div>
      <SegmentedButtons
        label="Pop-out brush does"
        helpId="popout.mode"
        value={mode}
        onChange={(m) => setBrush({ popOutMode: m })}
        options={[
          { value: 'add', label: 'Add', icon: <Paintbrush size={16} /> },
          { value: 'erase', label: 'Erase', icon: <Eraser size={16} /> },
        ]}
      />
      <Slider
        label="Pop-out brush size"
        helpId="popout.size"
        unit="px"
        defaultValue={TOOL_DEFAULTS.brushSize}
        min={BRUSH_MIN}
        max={BRUSH_MAX}
        value={size}
        onChange={(v) => setBrush({ brushSize: v })}
      />
      <Toggle label="Show the pop-out mask" helpId="popout.show" checked={showMask} onChange={(v) => setBrush({ showPopOut: v })} />
      <Toggle label="Pop-out on" helpId="popout.enabled" checked={popOut.enabled} onChange={(enabled) => setPopOut({ enabled })} />
      <Advanced helpId="popout.advanced">
        <Slider
          label="Pop-out brush softness"
          helpId="popout.softness"
          unit="%"
          defaultValue={TOOL_DEFAULTS.brushSoftness}
          min={0}
          max={100}
          value={softness}
          onChange={(v) => setBrush({ brushSoftness: v })}
        />
        <Toggle label="Pen pressure" helpId="image.pressure" checked={usePressure} onChange={(v) => setBrush({ usePressure: v })} />
      </Advanced>
      <button type="button" className="btn btn--ghost btn--small" disabled={!popOut.strokes.length} onClick={() => setPopOut({ strokes: [] })}>
        <RotateCcw size={16} aria-hidden="true" />
        Clear pop-out
      </button>
    </>
  );
}
