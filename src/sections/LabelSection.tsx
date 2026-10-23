import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Advanced, ColorSwatches, ControlLabel, SegmentedButtons, Slider, TileGrid, Toggle } from '../components';
import { LABEL_SHAPES, newLabel } from '../document/defaults';
import type { LabelAnchor, LabelSettings, LabelShape } from '../document/types';
import { setLabelAnchor, setLabelOn, setLabelPlace, setLabelShape, updateLabel } from '../editor/labelActions';
import { FONTS, fontFamily, fontInfo, isUploadedFont, UPLOAD_PREFIX } from '../fonts/catalog';
import { FONT_ACCEPT, fontNameFromFile, loadPickerFonts, refreshUploadedFonts, removeUploadedFont, saveUploadedFont, useUploadedFonts } from '../fonts/fontLoader';
import { useRovingRadio } from '../components/useRovingRadio';
import { labelText } from '../render/label';
import { commitDoc, useDoc } from '../state/tokenStore';
import { toast } from '../ui/toast';

/** Per-square values are shown as a percentage of one grid square (1 unit = half a square). */
const toPct = (v: number) => Math.round(v * 50 * 10) / 10;
const fromPct = (p: number) => p / 50;

const D = newLabel();
const FILL_SWATCHES = ['#e9d9b4', '#f4efe4', '#8e2a22', '#1c2433', '#2f4a2a', '#4a2f5c', '#c9a24a', '#20140a'];
const TEXT_SWATCHES = ['#3a2412', '#fff4dc', '#000000', '#ffffff', '#f0c850', '#8e2a22', '#c9d2de', '#76ff4a'];
const LINE_SWATCHES = ['#5a3d1e', '#20140a', '#000000', '#ffffff', '#c9a24a', '#8e2a22'];

/** Small pictures of each shape for the picker. */
function ShapeIcon({ shape }: { shape: LabelShape }) {
  const common = { fill: 'currentColor', fillOpacity: 0.25, stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 44 44" width={44} height={44} aria-hidden="true">
      {shape === 'banner' && (
        <>
          <path d="M3 25 l6 -2 v10 l-6 2 3 -5 z M41 25 l-6 -2 v10 l6 2 -3 -5 z" {...common} fillOpacity={0.45} />
          <path d="M9 18 Q22 24 35 18 v10 Q22 34 9 28 z" {...common} />
        </>
      )}
      {shape === 'plaque' && <path d="M10 14 h24 a4 4 0 0 0 4 4 v8 a4 4 0 0 0 -4 4 h-24 a4 4 0 0 0 -4 -4 v-8 a4 4 0 0 0 4 -4 z" {...common} />}
      {shape === 'pill' && <rect x="5" y="15" width="34" height="14" rx="7" {...common} />}
      {shape === 'box' && <rect x="5" y="15" width="34" height="14" rx="3" {...common} />}
      {shape === 'plain' && (
        <path d="M11 13 h22 v5 h-8.5 v14 h-5 v-14 h-8.5 z" fill="currentColor" />
      )}
      {shape === 'ring' && (
        <>
          <circle cx="22" cy="22" r="15" fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={5} />
          <path d="M9 29 A15 15 0 0 0 35 29" fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="3 2" />
        </>
      )}
    </svg>
  );
}

/**
 * Label section (DESIGN.md §6.10): a banner, plaque, pill or box with the
 * token's name, plain text (v8), or the name curved round the ring. Drag it on the canvas;
 * it snaps to the top or bottom of the frame.
 */
export function LabelSection() {
  const label = useDoc((d) => d.label);
  const name = useDoc((d) => d.name);
  useEffect(() => {
    void refreshUploadedFonts();
  }, []);

  if (!label) {
    return (
      <div className="control" data-control="label-add" data-help-id="label.add">
        <button type="button" className="btn btn--wide" onClick={() => setLabelOn(true)}>
          Add a label
        </button>
        <p className="control__hint">Puts the token's name on a banner. You can change the words, shape and font.</p>
      </div>
    );
  }
  const l = label;
  const ring = l.shape === 'ring';
  const set = (patch: Partial<LabelSettings>, transient = false) => updateLabel(patch, transient);
  return (
    <>
      <Toggle label="Show a label" helpId="label.add" checked onChange={() => setLabelOn(false)} />
      <TileGrid
        label="Shape"
        helpId="label.shape"
        value={l.shape}
        onChange={(v) => setLabelShape(v as LabelShape)}
        tiles={LABEL_SHAPES.map((s) => ({ id: s.id, label: s.name, preview: <ShapeIcon shape={s.id} /> }))}
      />
      <LabelTextInput text={l.text} name={name} />
      <FontPicker value={l.font} sample={labelText({ label: l, name })} />
      <Slider
        label="Text size"
        helpId="label.size"
        unit="% of a square"
        min={4}
        max={40}
        step={0.5}
        value={toPct(l.size)}
        defaultValue={toPct(D.size)}
        onChange={(v) => set({ size: fromPct(v) }, true)}
        onCommit={commitDoc}
      />
      <ColorSwatches label="Text colour" helpId="label.color" value={l.color} swatches={TEXT_SWATCHES} onChange={(color) => set({ color }, true)} onCommit={commitDoc} />
      <div className="control control--row" data-control="label-style" data-help-id="label.style">
        <ControlLabel label="Style" helpId="label.style" />
        <div className="label-style">
          <button type="button" className="icon-btn" aria-pressed={l.bold} aria-label="Bold" onClick={() => set({ bold: !l.bold })}>
            <Bold size={16} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" aria-pressed={l.italic} aria-label="Italic" onClick={() => set({ italic: !l.italic })}>
            <Italic size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <SegmentedButtons
        label="Alignment"
        helpId="label.align"
        value={l.align}
        onChange={(align) => set({ align })}
        options={[
          { value: 'left', label: 'Left', icon: <AlignLeft size={16} />, iconOnly: true },
          { value: 'center', label: 'Centre', icon: <AlignCenter size={16} />, iconOnly: true },
          { value: 'right', label: 'Right', icon: <AlignRight size={16} />, iconOnly: true },
        ]}
      />
      <SegmentedButtons
        label="Position"
        helpId="label.place"
        value={l.place}
        onChange={setLabelPlace}
        options={[
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
          { value: 'free', label: 'Free' },
        ]}
      />
      {l.place === 'free' && ring && (
        <Slider
          label="Round the ring"
          helpId="label.angle"
          unit="°"
          min={0}
          max={360}
          value={Math.round(((l.angle % 360) + 360) % 360)}
          defaultValue={90}
          onChange={(angle) => set({ angle }, true)}
          onCommit={commitDoc}
        />
      )}
      {l.place === 'free' && !ring && (
        <>
          <Slider
            label="Sideways"
            helpId="label.x"
            unit="%"
            min={-100}
            max={100}
            value={Math.round(l.x * 100)}
            defaultValue={0}
            onChange={(v) => set({ x: v / 100 }, true)}
            onCommit={commitDoc}
          />
          <Slider
            label="Up or down"
            helpId="label.y"
            unit="%"
            min={-100}
            max={100}
            value={Math.round(l.y * 100)}
            defaultValue={75}
            onChange={(v) => set({ y: v / 100 }, true)}
            onCommit={commitDoc}
          />
          <AnchorPicker value={l.anchor} />
          <Slider
            label="Rotation"
            helpId="label.rotation"
            unit="°"
            min={-180}
            max={180}
            value={Math.round(l.rotation)}
            defaultValue={0}
            onChange={(rotation) => set({ rotation }, true)}
            onCommit={commitDoc}
          />
        </>
      )}
      <p className="control__hint">Drag the label on the canvas to move it; it snaps to the top or bottom (hold Alt to place it freely).</p>
      {ring ? (
        <Slider
          label="Most of the ring it covers"
          helpId="label.arc"
          unit="°"
          min={30}
          max={360}
          value={Math.round(l.arc)}
          defaultValue={D.arc}
          onChange={(arc) => set({ arc }, true)}
          onCommit={commitDoc}
        />
      ) : (
        <>
          <Slider
            label="Width"
            helpId="label.width"
            unit="% of a square"
            min={20}
            max={200}
            value={toPct(l.width)}
            defaultValue={toPct(D.width)}
            onChange={(v) => set({ width: fromPct(v) }, true)}
            onCommit={commitDoc}
          />
          {l.shape === 'banner' && (
            <Slider
              label="Bend"
              helpId="label.curve"
              min={-100}
              max={100}
              value={Math.round(l.curve)}
              defaultValue={l.place === 'top' ? -D.curve : D.curve}
              onChange={(curve) => set({ curve }, true)}
              onCommit={commitDoc}
            />
          )}
          {l.shape === 'box' && (
            <SegmentedButtons
              label="Corners"
              helpId="label.corners"
              value={l.corners}
              onChange={(corners) => set({ corners })}
              options={[
                { value: 'rounded', label: 'Rounded' },
                { value: 'sharp', label: 'Sharp' },
              ]}
            />
          )}
          {l.shape !== 'plain' && (
            <>
          <ColorSwatches label="Shape colour" helpId="label.fill" value={l.fill} swatches={FILL_SWATCHES} onChange={(fill) => set({ fill }, true)} onCommit={commitDoc} />
          <Slider
            label="Shape opacity"
            helpId="label.opacity"
            unit="%"
            min={0}
            max={100}
            value={Math.round(l.opacity * 100)}
            defaultValue={100}
            onChange={(v) => set({ opacity: v / 100 }, true)}
            onCommit={commitDoc}
          />
          <Slider
            label="Shape outline"
            helpId="label.outline"
            unit="% of a square"
            min={0}
            max={6}
            step={0.1}
            value={toPct(l.outline.width)}
            defaultValue={toPct(D.outline.width)}
            onChange={(v) => set({ outline: { ...l.outline, width: fromPct(v) } }, true)}
            onCommit={commitDoc}
          />
          {l.outline.width > 0 && (
            <ColorSwatches
              label="Outline colour"
              helpId="label.outlineColor"
              value={l.outline.color}
              swatches={LINE_SWATCHES}
              onChange={(color) => set({ outline: { ...l.outline, color } }, true)}
              onCommit={commitDoc}
            />
          )}
            </>
          )}
        </>
      )}
      <Toggle label="Shrink long names to fit" helpId="label.shrink" checked={l.shrinkToFit} onChange={(shrinkToFit) => set({ shrinkToFit })} />
      <Advanced helpId="label.advanced">
        <Slider
          label="Letter spacing"
          helpId="label.spacing"
          unit="%"
          min={-10}
          max={50}
          value={Math.round(l.letterSpacing * 100)}
          defaultValue={Math.round(D.letterSpacing * 100)}
          onChange={(v) => set({ letterSpacing: v / 100 }, true)}
          onCommit={commitDoc}
        />
        <Slider
          label="Text outline"
          helpId="label.textOutline"
          unit="% of a square"
          min={0}
          max={6}
          step={0.1}
          value={toPct(l.textOutline.width)}
          defaultValue={0}
          onChange={(v) => set({ textOutline: { ...l.textOutline, width: fromPct(v) } }, true)}
          onCommit={commitDoc}
        />
        {l.textOutline.width > 0 && (
          <ColorSwatches
            label="Text outline colour"
            helpId="label.textOutlineColor"
            value={l.textOutline.color}
            swatches={LINE_SWATCHES}
            onChange={(color) => set({ textOutline: { ...l.textOutline, color } }, true)}
            onCommit={commitDoc}
          />
        )}
        <Toggle label="Text shadow" helpId="label.shadow" checked={l.shadow.enabled} onChange={(enabled) => set({ shadow: { ...l.shadow, enabled } })} />
        {l.shadow.enabled && (
          <>
            <ColorSwatches
              label="Shadow colour"
              helpId="label.shadowColor"
              value={l.shadow.color}
              swatches={['#000000', '#20140a', '#1c2433', '#8e2a22', '#ffffff']}
              onChange={(color) => set({ shadow: { ...l.shadow, color } }, true)}
              onCommit={commitDoc}
            />
            <Slider
              label="Shadow opacity"
              helpId="label.shadowOpacity"
              unit="%"
              min={0}
              max={100}
              value={Math.round(l.shadow.opacity * 100)}
              defaultValue={Math.round(D.shadow.opacity * 100)}
              onChange={(v) => set({ shadow: { ...l.shadow, opacity: v / 100 } }, true)}
              onCommit={commitDoc}
            />
            <Slider
              label="Shadow blur"
              helpId="label.shadowBlur"
              unit="% of a square"
              min={0}
              max={10}
              step={0.1}
              value={toPct(l.shadow.blur)}
              defaultValue={toPct(D.shadow.blur)}
              onChange={(v) => set({ shadow: { ...l.shadow, blur: fromPct(v) } }, true)}
              onCommit={commitDoc}
            />
          </>
        )}
      </Advanced>
    </>
  );
}

/** The label's words. Left empty, the label shows the token's name (and follows it when the name changes). */
const ANCHORS: { value: LabelAnchor; label: string }[] = [
  { value: 'topLeft', label: 'Top left' },
  { value: 'top', label: 'Top' },
  { value: 'topRight', label: 'Top right' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Middle' },
  { value: 'right', label: 'Right' },
  { value: 'bottomLeft', label: 'Bottom left' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'bottomRight', label: 'Bottom right' },
];

/** Nine buttons laid out like the label: which of its points sits at its position and is turned round. */
function AnchorPicker({ value }: { value: LabelAnchor }) {
  const labelId = useId();
  return (
    <div className="control" data-control="label-anchor" data-help-id="label.anchor">
      <ControlLabel id={labelId} label="Anchor point" helpId="label.anchor" />
      <div className="snap-grid" role="radiogroup" aria-labelledby={labelId}>
        {ANCHORS.map((a) => (
          <button key={a.value} type="button" role="radio" aria-checked={value === a.value} className="snap-grid__btn" data-anchor={a.value} title={a.label} onClick={() => setLabelAnchor(a.value)}>
            <span className="snap-grid__dot" aria-hidden="true" />
            <span className="visually-hidden">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LabelTextInput({ text, name }: { text: string | null; name: string }) {
  const id = useId();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="control" data-control="label-text" data-help-id="label.text">
      <ControlLabel htmlFor={id} label="Text" helpId="label.text" />
      <input
        id={id}
        className="text-input"
        type="text"
        maxLength={120}
        placeholder={name || 'Token name'}
        value={editing ?? text ?? ''}
        onChange={(e) => {
          setEditing(e.target.value);
          updateLabel({ text: e.target.value === '' ? null : e.target.value }, true);
        }}
        onBlur={() => {
          setEditing(null);
          commitDoc();
        }}
      />
      <p className="control__hint">Leave it empty to show the token's name.</p>
    </div>
  );
}

/** The fonts, each name shown in its own font, and your own uploaded fonts. */
function FontPicker({ value, sample }: { value: string; sample: string }) {
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const { uploads } = useUploadedFonts();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadPickerFonts();
  }, []);
  const options = [...FONTS.map((f) => ({ id: f.id, name: f.name, group: 'Built-in' })), ...uploads.map((f) => ({ id: `${UPLOAD_PREFIX}${f.id}`, name: f.name, group: 'Your fonts' }))];
  const ids = options.map((o) => o.id);
  const { onKeyDown, itemProps } = useRovingRadio(ids, value, (font) => updateLabel({ font }));
  const missing = !ids.includes(value);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const font = await saveUploadedFont(file, fontNameFromFile(file.name));
      updateLabel({ font });
      toast(`Added the font ${fontNameFromFile(file.name)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "That font couldn't be added.", 'error');
    } finally {
      setBusy(false);
    }
  };
  const own = isUploadedFont(value) && !missing;
  return (
    <div className="control font-picker" data-control="label-font" data-help-id="label.font">
      <ControlLabel id={labelId} label="Font" helpId="label.font" aside={fontInfo(value)?.name ?? options.find((o) => o.id === value)?.name ?? 'Missing font'} />
      <div className="font-picker__list" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        {options.map((o, i) => [
          i === FONTS.length && (
            <div key="own" className="font-picker__group" aria-hidden="true">
              Your fonts
            </div>
          ),
          <button
            key={o.id}
            type="button"
            className="font-picker__item"
            data-font={o.id}
            {...itemProps(o.id, i)}
            aria-label={o.name}
            title={o.group === 'Your fonts' ? `${o.name} (your font)` : o.name}
            style={{ fontFamily: `"${fontFamily(o.id)}", serif` }}
          >
            {o.name}
          </button>,
        ])}
      </div>
      {missing && <p className="control__hint">This label's font isn't saved in this browser, so a stand-in is used. Upload it again or pick another.</p>}
      <div className="control--row font-picker__actions" data-control="label-font-upload" data-help-id="label.uploadFont">
        <button type="button" className="btn btn--small" disabled={busy} onClick={() => input.current?.click()}>
          <Upload size={14} aria-hidden="true" />
          Upload a font
        </button>
        {own && (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => void removeUploadedFont(value.slice(UPLOAD_PREFIX.length)).then(() => updateLabel({ font: D.font }))}
          >
            <Trash2 size={14} aria-hidden="true" />
            Remove this font
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={FONT_ACCEPT}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="font-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
      <p className="font-picker__sample" aria-hidden="true" style={{ fontFamily: `"${fontFamily(value)}", serif` }}>
        {sample || 'Token name'}
      </p>
    </div>
  );
}
