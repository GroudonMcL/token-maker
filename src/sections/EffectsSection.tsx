import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Shuffle, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Advanced, ColorSwatches, ControlLabel, DirectionDial, GradientEditor, SegmentedButtons, Slider, Toggle } from '../components';
import { LabelTip } from '../components/LabelTip';
import { EFFECT_GROUPS, EFFECTS, effectInfo, MAX_EFFECTS, newEffect, newPictureEffect, type EffectControl } from '../document/defaults';
import type { BlendMode, EffectKind, EffectLayer, EffectPlacement } from '../document/types';
import { addPictureEffect, uploadPictureEffect } from '../editor/pictureActions';
import type { HelpId } from '../help/helpContent';
import { EFFECT_PICTURES, effectPicture, pictureUrl } from '../render/pictureLibrary';
import { refreshUploadedPictures, useUploadedPictures } from '../state/pictureLibrary';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';
import { effectThumbnails } from './effectThumbs';

const PLACEMENTS: { value: EffectPlacement; label: string }[] = [
  { value: 'behind', label: 'Behind art' },
  { value: 'over', label: 'Over art' },
  { value: 'border', label: 'On border' },
];

const BLENDS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply (darken)' },
  { value: 'screen', label: 'Screen (lighten)' },
  { value: 'overlay', label: 'Overlay (contrast)' },
  { value: 'soft-light', label: 'Soft light' },
];

const LAYOUTS = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'fill', label: 'Fill' },
] as const;

/** Per-square values are shown as a percentage of one grid square (1 unit = half a square). */
const toPct = (v: number) => Math.round(v * 50 * 10) / 10;
const fromPct = (p: number) => p / 50;

/** The help entry (with its before/after picture) for each kind of effect. */
const effectHelpId = (kind: EffectKind) => `effect.${kind}` as HelpId;

const update = (id: string, patch: Partial<EffectLayer>, transient = false) =>
  updateDoc((d) => ({ ...d, effects: d.effects.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), { transient });

/** An effect's name: its kind's, or its picture's. */
function effectName(e: EffectLayer, uploads: { id: string; name: string }[]): string {
  if (e.kind !== 'picture' || !e.image) return effectInfo(e.kind).name;
  return e.image.type === 'library' ? (effectPicture(e.image.id)?.name ?? 'Picture') : (uploads.find((u) => u.id === e.image!.id)?.name ?? 'Your picture');
}

/** The starting settings to compare sliders against (and reset them to). */
const startingSettings = (e: EffectLayer): EffectLayer => (e.kind === 'picture' && e.image ? newPictureEffect(e.image, e.id) : newEffect(e.kind, e.id));

/**
 * Effects section (DESIGN.md §6.8): a stack of glows, elemental effects,
 * condition looks, atmosphere, overlays (the Foreground section until v8)
 * and pictures. Each one sits behind the art, over it or on the border.
 */
export function EffectsSection() {
  const effects = useDoc((d) => d.effects);
  const shape = useDoc((d) => d.shape);
  const frame = useDoc((d) => d.frame);
  const [open, setOpen] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Map<string, string> | null>(null);
  const { pictures: uploads, loaded } = useUploadedPictures();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void refreshUploadedPictures();
  }, [loaded]);

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
  const opened = (id: string | null) => {
    if (id) setOpen(id);
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
                {group === 'Pictures' ? (
                  <>
                    {EFFECT_PICTURES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="tile"
                        data-effect-picture={p.id}
                        disabled={full}
                        onClick={() => void addPictureEffect({ type: 'library', id: p.id }).then(opened)}
                      >
                        <span className="tile__preview tile__preview--dark" aria-hidden="true">
                          <img src={pictureUrl(p.id)} alt="" width={44} height={44} loading="lazy" />
                        </span>
                        <LabelTip helpId="effect.picture" className="tile__label">
                          {p.name}
                        </LabelTip>
                      </button>
                    ))}
                    {uploads.map((p) => (
                      <button key={p.id} type="button" className="tile" disabled={full} onClick={() => void addPictureEffect({ type: 'upload', id: p.id }).then(opened)}>
                        <span className="tile__preview tile__preview--dark" aria-hidden="true">
                          <img src={p.url} alt="" width={44} height={44} />
                        </span>
                        <LabelTip helpId="effect.picture" className="tile__label">
                          {p.name}
                        </LabelTip>
                      </button>
                    ))}
                  </>
                ) : (
                  EFFECTS.filter((x) => x.group === group).map((x) => (
                    <button key={x.kind} type="button" className="tile" data-effect={x.kind} disabled={full} onClick={() => add(x.kind)}>
                      <span className="tile__preview" aria-hidden="true">
                        {thumbs?.get(x.kind) ? <img src={thumbs.get(x.kind)} alt="" width={44} height={44} /> : <span className="tile__blank" />}
                      </span>
                      <LabelTip helpId={effectHelpId(x.kind)} className="tile__label">
                        {x.name}
                      </LabelTip>
                    </button>
                  ))
                )}
              </div>
              {group === 'Pictures' && (
                <div className="control control--row" data-control="effect-upload" data-help-id="effects.upload">
                  <button type="button" className="btn btn--small" disabled={full} onClick={() => fileInput.current?.click()}>
                    <Upload size={14} aria-hidden="true" />
                    Use your own picture
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/webp,image/jpeg,image/gif,image/avif"
                    hidden
                    data-testid="effect-file-input"
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = '';
                      if (file) void uploadPictureEffect(file).then(opened);
                    }}
                  />
                </div>
              )}
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
              name={effectName(e, uploads)}
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
  name,
  open,
  onToggle,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  e: EffectLayer;
  name: string;
  open: boolean;
  onToggle: () => void;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const bodyId = useId();
  const blendId = useId();
  const info = effectInfo(e.kind);
  const start = startingSettings(e);
  const uses = (c: EffectControl) => info.controls.includes(c);
  const label = (c: EffectControl, fallback: string) => info.labels?.[c] ?? fallback;
  const where = PLACEMENTS.find((p) => p.value === e.placement)!.label.toLowerCase();
  const swatches = e.kind === 'picture' && e.image?.type === 'library' ? (effectPicture(e.image.id)?.swatches ?? info.swatches) : info.swatches;
  // Colour only matters for a picture when it's coloured in.
  const showColor = uses('color') && (e.kind !== 'picture' || e.tint);
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
          defaultValue={start.intensity}
          onChange={(intensity) => update(e.id, { intensity }, true)}
          onCommit={commitDoc}
        />
        <Slider
          label="Blur"
          helpId="effects.blur"
          unit="% of a square"
          min={0}
          max={25}
          step={0.5}
          value={toPct(e.blur)}
          defaultValue={0}
          onChange={(v) => update(e.id, { blur: fromPct(v) }, true)}
          onCommit={commitDoc}
        />
        {uses('gradient') && (
          <GradientEditor
            value={e.gradient}
            onChange={(gradient, transient) => update(e.id, { gradient }, transient)}
            onCommit={commitDoc}
            helpIds={{ type: 'background.gradientType', angle: 'background.gradientAngle', colors: 'background.gradientColors', stops: 'background.gradientStops' }}
          />
        )}
        {uses('picture') && (
          <>
            <SegmentedButtons label="Layout" helpId="effects.layout" value={e.layout} options={LAYOUTS} onChange={(layout) => update(e.id, { layout })} />
            <Toggle label="Colour it in" helpId="effects.tint" checked={e.tint} onChange={(tint) => update(e.id, { tint })} />
          </>
        )}
        {showColor && <ColorSwatches label="Colour" helpId="effects.color" value={e.color} swatches={swatches} onChange={(color) => update(e.id, { color }, true)} onCommit={commitDoc} />}
        {uses('angle') && (
          <DirectionDial
            label={label('angle', 'Side')}
            helpId="effects.angle"
            value={e.angle}
            describe={sideWords}
            onChange={(angle) => update(e.id, { angle }, true)}
            onCommit={commitDoc}
          />
        )}
        <Advanced helpId="effects.advanced">
          {uses('size') && (e.kind !== 'picture' || e.layout === 'scatter') && (
            <Slider
              label={label('size', 'Size')}
              helpId="effects.size"
              unit="% of a square"
              min={0}
              max={e.kind === 'picture' ? 100 : 50}
              step={0.5}
              value={toPct(e.size)}
              defaultValue={toPct(start.size)}
              onChange={(v) => update(e.id, { size: fromPct(v) }, true)}
              onCommit={commitDoc}
            />
          )}
          {uses('spread') && (e.kind !== 'picture' || e.layout === 'scatter') && (
            <Slider
              label={label('spread', 'Spread')}
              helpId="effects.spread"
              unit="%"
              min={0}
              max={100}
              value={e.spread}
              defaultValue={start.spread}
              onChange={(spread) => update(e.id, { spread }, true)}
              onCommit={commitDoc}
            />
          )}
          {uses('softness') && (
            <Slider
              label="Softness"
              helpId="effects.softness"
              unit="%"
              min={0}
              max={100}
              value={e.softness}
              defaultValue={start.softness}
              onChange={(softness) => update(e.id, { softness }, true)}
              onCommit={commitDoc}
            />
          )}
          <div className="control" data-control="blend" data-help-id="effects.blend">
            <ControlLabel htmlFor={blendId} label="Blend mode" helpId="effects.blend" />
            <select id={blendId} className="text-input" value={e.blend} onChange={(ev) => update(e.id, { blend: ev.target.value as BlendMode })}>
              {BLENDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          {uses('seed') && (e.kind !== 'picture' || e.layout === 'scatter') && (
            <button type="button" className="btn btn--ghost btn--small" data-control="button" data-help-id="effects.shuffle" onClick={() => update(e.id, { seed: (e.seed % 9999) + 1 })}>
              <Shuffle size={14} aria-hidden="true" />
              Shuffle
            </button>
          )}
        </Advanced>
      </div>
    </li>
  );
}

const SIDES = ['the right', 'bottom right', 'the bottom', 'bottom left', 'the left', 'top left', 'the top', 'top right'];
const sideWords = (d: number) => SIDES[Math.round((((d % 360) + 360) % 360) / 45) % 8]!;
