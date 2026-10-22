import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ColorSwatches, ControlLabel, Slider, Toggle } from '../components';
import { DECORATION_GROUPS, DECORATIONS, decorationInfo, MAX_DECORATIONS, newDecoration } from '../document/defaults';
import type { Decoration, DecorationKind, SnapPoint } from '../document/types';
import { selectDecoration, useTool } from '../editor/tools';
import { decorationGeometry, placements } from '../render/decorations';
import { commitDoc, getDoc, updateDoc, useDoc } from '../state/tokenStore';
import { decorationThumbnails } from './decorationThumbs';

/** Per-square values are shown as a percentage of one grid square (1 unit = half a square). */
const toPct = (v: number) => Math.round(v * 50 * 10) / 10;
const fromPct = (p: number) => p / 50;

const update = (id: string, patch: Partial<Decoration>, transient = false) =>
  updateDoc((d) => ({ ...d, decorations: d.decorations.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), { transient });

/** The snap grid, laid out like the token: top row, middle row (with Free in the middle), bottom row. */
const GRID: { place: SnapPoint | 'free'; label: string }[] = [
  { place: 'topLeft', label: 'Top left' },
  { place: 'top', label: 'Top' },
  { place: 'topRight', label: 'Top right' },
  { place: 'left', label: 'Left' },
  { place: 'free', label: 'Free' },
  { place: 'right', label: 'Right' },
  { place: 'bottomLeft', label: 'Bottom left' },
  { place: 'bottom', label: 'Bottom' },
  { place: 'bottomRight', label: 'Bottom right' },
];
const placeName = (place: Decoration['place']) => GRID.find((g) => g.place === place)!.label.toLowerCase();

/**
 * Decorations section (DESIGN.md §6.9): gems, skulls, horns, wings and more,
 * snapped round the frame (optionally mirrored) or placed freely. Tap one on
 * the canvas to drag it and get its resize and rotate handles.
 */
export function DecorationsSection() {
  const decorations = useDoc((d) => d.decorations);
  const selected = useTool((s) => s.selectedDecoration);
  const [thumbs, setThumbs] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    // Drawn after the panel appears, so opening it stays snappy.
    const id = requestAnimationFrame(() => setThumbs(decorationThumbnails()));
    return () => cancelAnimationFrame(id);
  }, []);

  const add = (kind: DecorationKind) => {
    const d = newDecoration(kind);
    updateDoc((doc) => ({ ...doc, decorations: [...doc.decorations, d] }));
    selectDecoration(d.id);
  };
  const move = (index: number, by: -1 | 1) =>
    updateDoc((d) => {
      const list = [...d.decorations];
      const [x] = list.splice(index, 1);
      list.splice(index + by, 0, x!);
      return { ...d, decorations: list };
    });
  const full = decorations.length >= MAX_DECORATIONS;
  const shown = decorations.map((d, i) => ({ d, i })).reverse();

  return (
    <>
      <div className="tile-grid" data-control="decoration-add" data-help-id="decorations.add">
        <ControlLabel label="Add a decoration" helpId="decorations.add" />
        <div className="tile-grid__groups">
          {DECORATION_GROUPS.map((group) => (
            <div key={group} className="tile-grid__group" role="group" aria-label={group}>
              <div className="tile-grid__group-name">{group}</div>
              <div className="tile-grid__tiles">
                {DECORATIONS.filter((x) => x.group === group).map((x) => (
                  <button key={x.kind} type="button" className="tile" data-decoration={x.kind} disabled={full} onClick={() => add(x.kind)}>
                    <span className="tile__preview" aria-hidden="true">
                      {thumbs?.get(x.kind) ? <img src={thumbs.get(x.kind)} alt="" width={44} height={44} /> : <span className="tile__blank" />}
                    </span>
                    <span className="tile__label">{x.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {decorations.length === 0 ? (
        <p className="control__hint">No decorations yet. Pick one above; it snaps onto the frame. Drag it on the canvas to move it.</p>
      ) : (
        <ol className="overlay-list" aria-label="Decorations, top first">
          {shown.map(({ d, i }) => (
            <DecorationCard
              key={d.id}
              d={d}
              open={selected === d.id}
              onToggle={() => selectDecoration(selected === d.id ? null : d.id)}
              canUp={i < decorations.length - 1}
              canDown={i > 0}
              onUp={() => move(i, 1)}
              onDown={() => move(i, -1)}
            />
          ))}
        </ol>
      )}
      {full && <p className="control__hint">That's the most decorations one token can have ({MAX_DECORATIONS}).</p>}
    </>
  );
}

function DecorationCard({
  d,
  open,
  onToggle,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  d: Decoration;
  open: boolean;
  onToggle: () => void;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const bodyId = useId();
  const info = decorationInfo(d.kind);
  const name = info.name;
  return (
    <li className="overlay-card" data-open={open} data-hidden={!d.visible || undefined} data-decoration={d.kind}>
      <div className="overlay-card__head">
        <button type="button" className="overlay-card__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <ChevronDown size={16} aria-hidden="true" className="overlay-card__chevron" />
          <span className="overlay-card__swatch" style={{ background: d.color }} aria-hidden="true" />
          {name}
          <span className="overlay-card__note">
            {placeName(d.place)}
            {d.mirror ? ', mirrored' : ''}
          </span>
        </button>
        <button type="button" className="icon-btn" aria-label={d.visible ? `Hide ${name}` : `Show ${name}`} aria-pressed={!d.visible} onClick={() => update(d.id, { visible: !d.visible })}>
          {d.visible ? <Eye size={16} /> : <EyeOff size={16} />}
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
          onClick={() => updateDoc((doc) => ({ ...doc, decorations: doc.decorations.filter((x) => x.id !== d.id) }))}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="overlay-card__body" id={bodyId} hidden={!open}>
        <SnapPicker d={d} />
        <Toggle label="Mirror on the other side" helpId="decorations.mirror" checked={d.mirror} onChange={(mirror) => update(d.id, { mirror })} />
        <Slider
          label="Size"
          helpId="decorations.size"
          unit="% of a square"
          min={2}
          max={100}
          step={0.5}
          value={toPct(d.size)}
          defaultValue={toPct(info.defaults.size)}
          onChange={(v) => update(d.id, { size: fromPct(v) }, true)}
          onCommit={commitDoc}
        />
        <Slider
          label="Rotation"
          helpId="decorations.rotation"
          unit="°"
          min={-180}
          max={180}
          value={Math.round(d.rotation)}
          defaultValue={info.defaults.rotation ?? 0}
          onChange={(rotation) => update(d.id, { rotation }, true)}
          onCommit={commitDoc}
        />
        <ColorSwatches label="Tint" helpId="decorations.color" value={d.color} swatches={info.swatches} onChange={(color) => update(d.id, { color }, true)} onCommit={commitDoc} />
        <Slider
          label="Opacity"
          helpId="decorations.opacity"
          unit="%"
          min={0}
          max={100}
          value={Math.round(d.opacity * 100)}
          defaultValue={100}
          onChange={(v) => update(d.id, { opacity: v / 100 }, true)}
          onCommit={commitDoc}
        />
        <Toggle label="Flip" helpId="decorations.flip" checked={d.flip} onChange={(flip) => update(d.id, { flip })} />
      </div>
    </li>
  );
}

/** Nine buttons laid out like the token: the eight snap points round the frame, and Free in the middle. */
function SnapPicker({ d }: { d: Decoration }) {
  const labelId = useId();
  const choose = (place: Decoration['place']) => {
    if (place === d.place) return;
    if (place === 'free') {
      // Keep it exactly where it is, just no longer snapped.
      const p = placements({ ...d, mirror: false }, decorationGeometry(getDoc()))[0]!;
      update(d.id, { place, x: p.x, y: p.y, rotation: p.rotation });
    } else update(d.id, { place, rotation: d.place === 'free' ? 0 : d.rotation });
  };
  return (
    <div className="control" data-control="decoration-place" data-help-id="decorations.place">
      <ControlLabel id={labelId} label="Position" helpId="decorations.place" />
      <div className="snap-grid" role="radiogroup" aria-labelledby={labelId}>
        {GRID.map((g) => (
          <button key={g.place} type="button" role="radio" aria-checked={d.place === g.place} className="snap-grid__btn" data-place={g.place} onClick={() => choose(g.place)}>
            {g.place === 'free' ? 'Free' : <span className="snap-grid__dot" aria-hidden="true" />}
            {g.place !== 'free' && <span className="visually-hidden">{g.label}</span>}
          </button>
        ))}
      </div>
      <p className="control__hint">
        Drag it on the canvas to move it; it snaps to these points (hold Alt to place it freely).
      </p>
    </div>
  );
}
