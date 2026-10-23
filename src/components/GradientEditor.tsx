import { Plus, X } from 'lucide-react';
import type { Gradient, GradientStop } from '../document/types';
import type { HelpId } from '../help/helpContent';
import { mix } from '../render/color';
import { Advanced } from './Section';
import { ColorSwatches } from './ColorSwatches';
import { SegmentedButtons } from './SegmentedButtons';
import { Slider } from './Slider';

const SWATCHES = ['#000000', '#1b2233', '#3d5a80', '#7fb2d8', '#ffffff', '#ffd9a0', '#ff7a12', '#b8322a', '#5b2d7a', '#2f5a24'];

/**
 * A gradient editor (DESIGN.md §6.3): simple shows the type, angle and two
 * colours; Advanced lists every stop with its position, colour and opacity,
 * and stops can be added and removed.
 *
 * `onChange(g, true)` is a live change while dragging; `onCommit` ends it.
 */
export function GradientEditor({
  value: g,
  onChange,
  onCommit,
  helpIds,
}: {
  value: Gradient;
  onChange: (g: Gradient, transient?: boolean) => void;
  onCommit: () => void;
  helpIds: { type: HelpId; angle: HelpId; colors: HelpId; stops: HelpId };
}) {
  const first = g.stops[0]!;
  const last = g.stops[g.stops.length - 1]!;
  const setStop = (i: number, patch: Partial<GradientStop>, transient = false) => {
    const stops = g.stops.map((s, k) => (k === i ? { ...s, ...patch } : s));
    onChange({ ...g, stops: transient ? stops : [...stops].sort((a, b) => a.offset - b.offset) }, transient);
  };
  const addStop = () => {
    // Between the two stops furthest apart, in their mixed colour.
    let at = 0;
    for (let i = 1; i < g.stops.length; i++) if (g.stops[i]!.offset - g.stops[i - 1]!.offset > g.stops[at + 1]!.offset - g.stops[at]!.offset) at = i - 1;
    const a = g.stops[at]!;
    const b = g.stops[at + 1]!;
    const stop = { offset: (a.offset + b.offset) / 2, color: mix(a.color, b.color, 0.5), opacity: (a.opacity + b.opacity) / 2 };
    onChange({ ...g, stops: [...g.stops, stop].sort((x, y) => x.offset - y.offset) });
  };
  return (
    <div className="gradient-editor">
      <SegmentedButtons
        label="Gradient type"
        helpId={helpIds.type}
        value={g.type}
        onChange={(type) => onChange({ ...g, type })}
        options={[
          { value: 'linear', label: 'Linear' },
          { value: 'radial', label: 'Radial' },
        ]}
      />
      {g.type === 'linear' && (
        <Slider
          label="Angle"
          helpId={helpIds.angle}
          unit="°"
          min={0}
          max={359}
          value={Math.round(((g.angle % 360) + 360) % 360)}
          defaultValue={90}
          onChange={(angle) => onChange({ ...g, angle }, true)}
          onCommit={onCommit}
        />
      )}
      <ColorSwatches
        label={g.type === 'radial' ? 'Middle colour' : 'Start colour'}
        helpId={helpIds.colors}
        value={first.color}
        swatches={SWATCHES}
        onChange={(color) => setStop(0, { color }, true)}
        onCommit={onCommit}
      />
      <ColorSwatches
        label={g.type === 'radial' ? 'Outer colour' : 'End colour'}
        helpId={helpIds.colors}
        value={last.color}
        swatches={SWATCHES}
        onChange={(color) => setStop(g.stops.length - 1, { color }, true)}
        onCommit={onCommit}
      />
      <Advanced>
        <div className="gradient-stops" data-control="gradient-stops" data-help-id={helpIds.stops}>
          {g.stops.map((s, i) => (
            <div key={i} className="gradient-stop">
              <div className="gradient-stop__head">
                <input
                  type="color"
                  className="gradient-stop__color"
                  aria-label={`Stop ${i + 1} colour`}
                  value={s.color}
                  onChange={(e) => setStop(i, { color: e.target.value }, true)}
                  onBlur={onCommit}
                />
                <span className="gradient-stop__name">Stop {i + 1}</span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove stop ${i + 1}`}
                  disabled={g.stops.length <= 2}
                  onClick={() => onChange({ ...g, stops: g.stops.filter((_, k) => k !== i) })}
                >
                  <X size={16} />
                </button>
              </div>
              <Slider
                label="Position"
                helpId={helpIds.stops}
                unit="%"
                min={0}
                max={100}
                value={Math.round(s.offset * 100)}
                onChange={(v) => setStop(i, { offset: v / 100 }, true)}
                onCommit={() => {
                  // Keep the stops in order once the drag ends.
                  onChange({ ...g, stops: [...g.stops].sort((a, b) => a.offset - b.offset) }, true);
                  onCommit();
                }}
              />
              <Slider
                label="Opacity"
                helpId={helpIds.stops}
                unit="%"
                min={0}
                max={100}
                value={Math.round(s.opacity * 100)}
                defaultValue={100}
                onChange={(v) => setStop(i, { opacity: v / 100 }, true)}
                onCommit={onCommit}
              />
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--small" onClick={addStop} disabled={g.stops.length >= 16}>
            <Plus size={14} aria-hidden="true" />
            Add a stop
          </button>
        </div>
      </Advanced>
    </div>
  );
}
