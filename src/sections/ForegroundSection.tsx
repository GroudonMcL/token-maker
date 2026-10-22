import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Plus, Shuffle, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { ColorSwatches, ControlLabel, DirectionDial, GradientEditor, Slider } from '../components';
import { newOverlay, OVERLAY_NAMES } from '../document/defaults';
import type { BlendMode, OverlayKind, OverlayLayer } from '../document/types';
import type { HelpId } from '../help/helpContent';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';

const KINDS: OverlayKind[] = ['vignette', 'gradient', 'shadow', 'mist', 'smoke', 'foliage', 'cobwebs'];
const BLENDS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply (darken)' },
  { value: 'screen', label: 'Screen (lighten)' },
  { value: 'overlay', label: 'Overlay (contrast)' },
  { value: 'soft-light', label: 'Soft light' },
];
const SWATCHES: Record<OverlayKind, string[]> = {
  gradient: [],
  vignette: ['#000000', '#120c08', '#1b2233', '#3a0d0d', '#ffffff'],
  shadow: ['#000000', '#1b1020', '#0b1a2a', '#2a1a0b'],
  mist: ['#dfe6ef', '#ffffff', '#c9d6c0', '#b7c4e0', '#e8d6c0'],
  smoke: ['#c9ccd6', '#5b5f6b', '#2a2a30', '#76ff4a', '#8b5cd6'],
  foliage: ['#2f5a24', '#4d7a2a', '#7a8a2a', '#8a4a1a', '#3a3a2a'],
  cobwebs: ['#e8e8ea', '#c9ccd6', '#9a9aa6'],
};
/** The settings each kind uses, besides opacity and blend. */
const USES: Record<OverlayKind, ('color' | 'size' | 'softness' | 'angle' | 'scale' | 'seed' | 'gradient')[]> = {
  gradient: ['gradient'],
  vignette: ['color', 'size', 'softness'],
  shadow: ['color', 'angle', 'size', 'softness'],
  mist: ['color', 'angle', 'size', 'softness', 'scale', 'seed'],
  smoke: ['color', 'size', 'softness', 'scale', 'seed'],
  foliage: ['color', 'angle', 'size', 'scale', 'seed'],
  cobwebs: ['color', 'angle', 'size', 'scale', 'seed'],
};
const SIZE_LABEL: Partial<Record<OverlayKind, string>> = { smoke: 'Amount', vignette: 'Size', foliage: 'Reach', cobwebs: 'Size' };
const ANGLE_LABEL: Partial<Record<OverlayKind, string>> = { cobwebs: 'Corner', shadow: 'Side', mist: 'Side', foliage: 'Grows from' };

const update = (id: string, patch: Partial<OverlayLayer>, transient = false) =>
  updateDoc((d) => ({ ...d, foreground: d.foreground.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), { transient });

/** Foreground section (DESIGN.md §6.4): a stack of overlays over the art, inside the frame. */
export function ForegroundSection() {
  const overlays = useDoc((d) => d.foreground);
  const [open, setOpen] = useState<string | null>(null);

  const add = (kind: OverlayKind) => {
    const o = newOverlay(kind);
    // Newest on top, which is the end of the list (drawn last).
    updateDoc((d) => ({ ...d, foreground: [...d.foreground, o] }));
    setOpen(o.id);
  };
  const move = (index: number, by: -1 | 1) =>
    updateDoc((d) => {
      const list = [...d.foreground];
      const [o] = list.splice(index, 1);
      list.splice(index + by, 0, o!);
      return { ...d, foreground: list };
    });

  // Shown top layer first, like layers in a paint program.
  const shown = overlays.map((o, i) => ({ o, i })).reverse();
  return (
    <>
      <div className="control" data-control="overlay-add" data-help-id="foreground.add">
        <ControlLabel label="Add an overlay" helpId="foreground.add" />
        <div className="chip-row">
          {KINDS.map((k) => (
            <button key={k} type="button" className="btn btn--small" onClick={() => add(k)} disabled={overlays.length >= 12}>
              <Plus size={14} aria-hidden="true" />
              {OVERLAY_NAMES[k]}
            </button>
          ))}
        </div>
      </div>
      {overlays.length === 0 ? (
        <p className="control__hint">No overlays yet. They're drawn over the art, inside the frame; the top of the list is drawn last.</p>
      ) : (
        <ol className="overlay-list" aria-label="Overlays, top first">
          {shown.map(({ o, i }) => (
            <OverlayCard
              key={o.id}
              o={o}
              open={open === o.id}
              onToggle={() => setOpen(open === o.id ? null : o.id)}
              canUp={i < overlays.length - 1}
              canDown={i > 0}
              onUp={() => move(i, 1)}
              onDown={() => move(i, -1)}
            />
          ))}
        </ol>
      )}
    </>
  );
}

function OverlayCard({
  o,
  open,
  onToggle,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  o: OverlayLayer;
  open: boolean;
  onToggle: () => void;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const bodyId = useId();
  const blendId = useId();
  const uses = USES[o.kind];
  const name = OVERLAY_NAMES[o.kind];
  const help = (k: string) => `foreground.${k}` as HelpId;
  return (
    <li className="overlay-card" data-open={open} data-hidden={!o.visible || undefined}>
      <div className="overlay-card__head">
        <button type="button" className="overlay-card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <ChevronDown size={16} aria-hidden="true" className="overlay-card__chevron" />
          {name}
        </button>
        <button type="button" className="icon-btn" aria-label={o.visible ? `Hide ${name}` : `Show ${name}`} aria-pressed={!o.visible} onClick={() => update(o.id, { visible: !o.visible })}>
          {o.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button type="button" className="icon-btn" aria-label={`Move ${name} up`} disabled={!canUp} onClick={onUp}>
          <ArrowUp size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label={`Move ${name} down`} disabled={!canDown} onClick={onDown}>
          <ArrowDown size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Remove ${name}`}
          onClick={() => updateDoc((d) => ({ ...d, foreground: d.foreground.filter((x) => x.id !== o.id) }))}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="overlay-card__body" id={bodyId} hidden={!open}>
        {uses.includes('gradient') && (
          <GradientEditor
            value={o.gradient}
            onChange={(gradient, transient) => update(o.id, { gradient }, transient)}
            onCommit={commitDoc}
            helpIds={{ type: 'background.gradientType', angle: 'background.gradientAngle', colors: 'background.gradientColors', stops: 'background.gradientStops' }}
          />
        )}
        {uses.includes('color') && (
          <ColorSwatches label="Colour" helpId={help('color')} value={o.color} swatches={SWATCHES[o.kind]} onChange={(color) => update(o.id, { color }, true)} onCommit={commitDoc} />
        )}
        {uses.includes('angle') && (
          <DirectionDial
            label={ANGLE_LABEL[o.kind] ?? 'Side'}
            helpId={help('angle')}
            value={o.angle}
            describe={(d) => sideWords(d)}
            onChange={(angle) => update(o.id, { angle }, true)}
            onCommit={commitDoc}
          />
        )}
        {uses.includes('size') && (
          <Slider label={SIZE_LABEL[o.kind] ?? 'Reach'} helpId={help('size')} unit="%" min={0} max={100} value={o.size} defaultValue={newOverlay(o.kind).size} onChange={(size) => update(o.id, { size }, true)} onCommit={commitDoc} />
        )}
        {uses.includes('softness') && (
          <Slider label="Softness" helpId={help('softness')} unit="%" min={0} max={100} value={o.softness} defaultValue={newOverlay(o.kind).softness} onChange={(softness) => update(o.id, { softness }, true)} onCommit={commitDoc} />
        )}
        {uses.includes('scale') && (
          <Slider label="Scale" helpId={help('scale')} unit="%" min={50} max={200} step={5} value={o.scale} defaultValue={100} onChange={(scale) => update(o.id, { scale }, true)} onCommit={commitDoc} />
        )}
        <Slider label="Opacity" helpId={help('opacity')} unit="%" min={0} max={100} value={Math.round(o.opacity * 100)} defaultValue={Math.round(newOverlay(o.kind).opacity * 100)} onChange={(v) => update(o.id, { opacity: v / 100 }, true)} onCommit={commitDoc} />
        <div className="control" data-control="blend" data-help-id="foreground.blend">
          <ControlLabel htmlFor={blendId} label="Blend mode" helpId="foreground.blend" />
          <select id={blendId} className="text-input" value={o.blend} onChange={(e) => update(o.id, { blend: e.target.value as BlendMode })}>
            {BLENDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        {uses.includes('seed') && (
          <button type="button" className="btn btn--ghost btn--small" data-control="button" data-help-id="foreground.shuffle" onClick={() => update(o.id, { seed: (o.seed % 9999) + 1 })}>
            <Shuffle size={14} aria-hidden="true" />
            Shuffle the layout
          </button>
        )}
      </div>
    </li>
  );
}

const SIDES = ['the right', 'bottom right', 'the bottom', 'bottom left', 'the left', 'top left', 'the top', 'top right'];
const sideWords = (d: number) => SIDES[Math.round((((d % 360) + 360) % 360) / 45) % 8]!;
