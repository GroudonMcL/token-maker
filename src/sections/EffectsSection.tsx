import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Shuffle, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Advanced, ColorSwatches, ControlLabel, SegmentedButtons, Slider } from '../components';
import { LabelTip } from '../components/LabelTip';
import { EFFECT_GROUPS, EFFECTS, effectInfo, MAX_EFFECTS, newEffect } from '../document/defaults';
import type { EffectKind, EffectLayer, EffectPlacement } from '../document/types';
import type { HelpId } from '../help/helpContent';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';
import { effectThumbnails } from './effectThumbs';

const PLACEMENTS: { value: EffectPlacement; label: string }[] = [
  { value: 'behind', label: 'Behind art' },
  { value: 'over', label: 'Over art' },
  { value: 'border', label: 'On border' },
];

/** Per-square values are shown as a percentage of one grid square (1 unit = half a square). */
const toPct = (v: number) => Math.round(v * 50 * 10) / 10;
const fromPct = (p: number) => p / 50;

/** The help entry (with its before/after picture) for each kind of effect. */
const effectHelpId = (kind: EffectKind) => `effect.${kind}` as HelpId;

const update = (id: string, patch: Partial<EffectLayer>, transient = false) =>
  updateDoc((d) => ({ ...d, effects: d.effects.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), { transient });

/**
 * Effects section (DESIGN.md §6.8): a stack of glows, elemental effects,
 * condition looks and atmosphere. Each one sits behind the art, over it or
 * on the border.
 */
export function EffectsSection() {
  const effects = useDoc((d) => d.effects);
  const shape = useDoc((d) => d.shape);
  const frame = useDoc((d) => d.frame);
  const [open, setOpen] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    // Drawn after the panel appears, so opening it stays snappy.
    const id = requestAnimationFrame(() => setThumbs(effectThumbnails({ shape, frame })));
    return () => cancelAnimationFrame(id);
  }, [shape, frame]);

  const add = (kind: EffectKind) => {
    const e = newEffect(kind);
    // Newest on top, which is the end of the list (drawn last).
    updateDoc((d) => ({ ...d, effects: [...d.effects, e] }));
    setOpen(e.id);
  };
  const move = (index: number, by: -1 | 1) =>
    updateDoc((d) => {
      const list = [...d.effects];
      const [e] = list.splice(index, 1);
      list.splice(index + by, 0, e!);
      return { ...d, effects: list };
    });
  const full = effects.length >= MAX_EFFECTS;

  // Shown top layer first, like layers in a paint program.
  const shown = effects.map((e, i) => ({ e, i })).reverse();
  return (
    <>
      <div className="tile-grid" data-control="effect-add" data-help-id="effects.add">
        <ControlLabel label="Add an effect" helpId="effects.add" />
        <div className="tile-grid__groups">
          {EFFECT_GROUPS.map((group) => (
            <div key={group} className="tile-grid__group" role="group" aria-label={group}>
              <div className="tile-grid__group-name">{group}</div>
              <div className="tile-grid__tiles">
                {EFFECTS.filter((x) => x.group === group).map((x) => (
                  <button key={x.kind} type="button" className="tile" data-effect={x.kind} disabled={full} onClick={() => add(x.kind)}>
                    <span className="tile__preview" aria-hidden="true">
                      {thumbs?.get(x.kind) ? <img src={thumbs.get(x.kind)} alt="" width={44} height={44} /> : <span className="tile__blank" />}
                    </span>
                    <LabelTip helpId={effectHelpId(x.kind)} className="tile__label">
                      {x.name}
                    </LabelTip>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {effects.length === 0 ? (
        <p className="control__hint">No effects yet. Pick one above; you can stack as many as you like and move them up and down.</p>
      ) : (
        <ol className="overlay-list" aria-label="Effects, top first">
          {shown.map(({ e, i }) => (
            <EffectCard
              key={e.id}
              e={e}
              open={open === e.id}
              onToggle={() => setOpen(open === e.id ? null : e.id)}
              canUp={i < effects.length - 1}
              canDown={i > 0}
              onUp={() => move(i, 1)}
              onDown={() => move(i, -1)}
            />
          ))}
        </ol>
      )}
      {full && <p className="control__hint">That's the most effects one token can have ({MAX_EFFECTS}).</p>}
    </>
  );
}

function EffectCard({
  e,
  open,
  onToggle,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  e: EffectLayer;
  open: boolean;
  onToggle: () => void;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const bodyId = useId();
  const info = effectInfo(e.kind);
  const name = info.name;
  const where = PLACEMENTS.find((p) => p.value === e.placement)!.label.toLowerCase();
  return (
    <li className="overlay-card" data-open={open} data-hidden={!e.visible || undefined} data-effect={e.kind}>
      <div className="overlay-card__head">
        <button type="button" className="overlay-card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <ChevronDown size={16} aria-hidden="true" className="overlay-card__chevron" />
          <span className="overlay-card__swatch" style={{ background: e.color }} aria-hidden="true" />
          {name}
          <span className="overlay-card__note">{where}</span>
        </button>
        <button type="button" className="icon-btn" aria-label={e.visible ? `Hide ${name}` : `Show ${name}`} aria-pressed={!e.visible} onClick={() => update(e.id, { visible: !e.visible })}>
          {e.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button type="button" className="icon-btn" aria-label={`Move ${name} up`} disabled={!canUp} onClick={onUp}>
          <ArrowUp size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label={`Move ${name} down`} disabled={!canDown} onClick={onDown}>
          <ArrowDown size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label={`Remove ${name}`} onClick={() => updateDoc((d) => ({ ...d, effects: d.effects.filter((x) => x.id !== e.id) }))}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="overlay-card__body" id={bodyId} hidden={!open}>
        <SegmentedButtons label="Placement" helpId="effects.placement" value={e.placement} options={PLACEMENTS} onChange={(placement) => update(e.id, { placement })} />
        <Slider
          label="Intensity"
          helpId="effects.intensity"
          unit="%"
          min={0}
          max={100}
          value={e.intensity}
          defaultValue={info.defaults.intensity}
          onChange={(intensity) => update(e.id, { intensity }, true)}
          onCommit={commitDoc}
        />
        <Advanced helpId="effects.advanced">
          <ColorSwatches label="Colour" helpId="effects.color" value={e.color} swatches={info.swatches} onChange={(color) => update(e.id, { color }, true)} onCommit={commitDoc} />
          <Slider
            label="Size"
            helpId="effects.size"
            unit="% of a square"
            min={0}
            max={50}
            step={0.5}
            value={toPct(e.size)}
            defaultValue={toPct(info.defaults.size)}
            onChange={(v) => update(e.id, { size: fromPct(v) }, true)}
            onCommit={commitDoc}
          />
          <Slider
            label="Spread"
            helpId="effects.spread"
            unit="%"
            min={0}
            max={100}
            value={e.spread}
            defaultValue={info.defaults.spread}
            onChange={(spread) => update(e.id, { spread }, true)}
            onCommit={commitDoc}
          />
          <button type="button" className="btn btn--ghost btn--small" data-control="button" data-help-id="effects.shuffle" onClick={() => update(e.id, { seed: (e.seed % 9999) + 1 })}>
            <Shuffle size={14} aria-hidden="true" />
            Shuffle
          </button>
        </Advanced>
      </div>
    </li>
  );
}
