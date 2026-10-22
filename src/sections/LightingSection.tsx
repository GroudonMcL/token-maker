import { Flame, FlameKindling, Moon, Sparkles, Sun, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { ColorSwatches, ControlLabel, DirectionDial, Slider, Toggle } from '../components';
import { createDocument, DEFAULT_LIGHTING, LIGHT_PRESETS } from '../document/defaults';
import type { InnerShadow, LightingSettings, LightPresetId, OuterShadow, ShadowSettings } from '../document/types';
import type { HelpId } from '../help/helpContent';
import { commitDoc, updateDoc, useDoc } from '../state/tokenStore';

const SWATCHES = ['#ffe2b0', '#ffa04a', '#ff6a22', '#fff1b8', '#9db8ff', '#76ff4a', '#8b5cd6', '#ff4a6a', '#ffffff'];
const PRESET_ICONS: Record<LightPresetId, ReactNode> = {
  torchlight: <FlameKindling size={16} />,
  moonlight: <Moon size={16} />,
  holy: <Sun size={16} />,
  fel: <Zap size={16} />,
  firelight: <Flame size={16} />,
  underdark: <Sparkles size={16} />,
};

/** A change made by hand: the preset no longer describes the light. */
const setLight = (patch: Partial<LightingSettings>, transient = false) =>
  updateDoc((d) => ({ ...d, lighting: { ...d.lighting, ...patch, preset: null } }), { transient });

/**
 * Lighting & shadows section (DESIGN.md §6.5, §6.7). The direction is
 * always shown, because shadows fall away from it even with the light off.
 */
export function LightingSection() {
  const l = useDoc((d) => d.lighting);
  const applyPreset = (id: LightPresetId) => {
    const p = LIGHT_PRESETS.find((x) => x.id === id)!;
    updateDoc((d) => ({ ...d, lighting: { ...d.lighting, ...p.settings, rim: { ...p.settings.rim }, enabled: true, preset: id } }));
  };
  return (
    <>
      <div className="control" data-control="light-presets" data-help-id="lighting.presets">
        <ControlLabel label="Presets" helpId="lighting.presets" />
        <div className="preset-grid" role="group" aria-label="Lighting presets">
          {LIGHT_PRESETS.map((p) => (
            <button key={p.id} type="button" className="btn btn--small preset-btn" aria-pressed={l.enabled && l.preset === p.id} onClick={() => applyPreset(p.id)}>
              <span className="preset-btn__swatch" style={{ background: p.settings.color }} aria-hidden="true" />
              {PRESET_ICONS[p.id]}
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Light the art" helpId="lighting.enabled" checked={l.enabled} onChange={(enabled) => updateDoc((d) => ({ ...d, lighting: { ...d.lighting, enabled } }))} />
      <DirectionDial
        label="Light comes from"
        helpId="lighting.direction"
        value={l.direction}
        onChange={(direction) => setLight({ direction }, true)}
        onCommit={commitDoc}
      />
      {l.enabled && (
        <>
          <ColorSwatches label="Light colour" helpId="lighting.color" value={l.color} swatches={SWATCHES} onChange={(color) => setLight({ color }, true)} onCommit={commitDoc} />
          <Slider
            label="Strength"
            helpId="lighting.strength"
            unit="%"
            min={0}
            max={100}
            value={l.strength}
            defaultValue={DEFAULT_LIGHTING.strength}
            onChange={(strength) => setLight({ strength }, true)}
            onCommit={commitDoc}
          />
          <Slider
            label="Darkness away from the light"
            helpId="lighting.falloff"
            unit="%"
            min={0}
            max={100}
            value={l.falloff}
            defaultValue={DEFAULT_LIGHTING.falloff}
            onChange={(falloff) => setLight({ falloff }, true)}
            onCommit={commitDoc}
          />
          <Toggle label="Rim light" helpId="lighting.rim" checked={l.rim.enabled} onChange={(enabled) => setLight({ rim: { ...l.rim, enabled } })} />
          {l.rim.enabled && (
            <>
              <Slider
                label="Rim strength"
                helpId="lighting.rimStrength"
                unit="%"
                min={0}
                max={100}
                value={l.rim.strength}
                defaultValue={DEFAULT_LIGHTING.rim.strength}
                onChange={(strength) => setLight({ rim: { ...l.rim, strength } }, true)}
                onCommit={commitDoc}
              />
              <Slider
                label="Rim width"
                helpId="lighting.rimWidth"
                unit="%"
                min={0}
                max={100}
                value={l.rim.width}
                defaultValue={DEFAULT_LIGHTING.rim.width}
                onChange={(width) => setLight({ rim: { ...l.rim, width } }, true)}
                onCommit={commitDoc}
              />
              <Slider
                label="Rim softness"
                helpId="lighting.rimSoftness"
                unit="%"
                min={0}
                max={100}
                value={l.rim.softness}
                defaultValue={DEFAULT_LIGHTING.rim.softness}
                onChange={(softness) => setLight({ rim: { ...l.rim, softness } }, true)}
                onCommit={commitDoc}
              />
            </>
          )}
          <Toggle
            label="Light the background too"
            helpId="lighting.background"
            checked={l.background}
            onChange={(background) => updateDoc((d) => ({ ...d, lighting: { ...d.lighting, background } }))}
          />
        </>
      )}
      <Shadows />
    </>
  );
}

const SHADOW_DEFAULTS = createDocument().shadows;
const SHADOW_SWATCHES = ['#000000', '#1b1020', '#14213d', '#2b1a0e', '#3a0d0d', '#ffffff'];

/** Per-square values are shown as a percentage of one grid square (1 unit = half a square). */
const toPct = (v: number) => Math.round(v * 50 * 10) / 10;
const fromPct = (p: number) => p / 50;

const FALLS: Record<string, string> = {
  right: 'to the right',
  'bottom right': 'down and right',
  below: 'down',
  'bottom left': 'down and left',
  left: 'to the left',
  'top left': 'up and left',
  above: 'up',
  'top right': 'up and right',
};
const SIDES = ['right', 'bottom right', 'below', 'bottom left', 'left', 'top left', 'above', 'top right'];
const falls = (deg: number) => `falls ${FALLS[SIDES[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!]}`;

const setShadow = <K extends keyof ShadowSettings>(key: K, patch: Partial<ShadowSettings[K]>, transient = false) =>
  updateDoc((d) => ({ ...d, shadows: { ...d.shadows, [key]: { ...d.shadows[key], ...patch } } }), { transient });

/** Shadow controls (DESIGN.md §6.7): outer drop shadow, pop-out shadow and the frame's shadow onto the art. */
function Shadows() {
  const shadows = useDoc((d) => d.shadows);
  const lightFrom = useDoc((d) => d.lighting.direction);
  const hasPopOut = useDoc((d) => d.art.popOut.enabled && d.art.popOut.strokes.length > 0);
  return (
    <>
      <CastShadow
        which="outer"
        title="Drop shadow"
        toggleLabel="Drop shadow"
        helpId="shadows.outer"
        shadow={shadows.outer}
        lightFrom={lightFrom}
      />
      <CastShadow
        which="popOut"
        title="Pop-out shadow"
        toggleLabel="Pop-out shadow"
        helpId="shadows.popOut"
        shadow={shadows.popOut}
        lightFrom={lightFrom}
        hint={hasPopOut ? undefined : 'Shows once you paint a pop-out (in the Pop-out section).'}
      />
      <InnerShadowControls shadow={shadows.inner} />
    </>
  );
}

function CastShadow({
  which,
  title,
  toggleLabel,
  helpId,
  shadow,
  lightFrom,
  hint,
}: {
  which: 'outer' | 'popOut';
  title: string;
  toggleLabel: string;
  helpId: HelpId;
  shadow: OuterShadow;
  lightFrom: number;
  hint?: string;
}) {
  const base = SHADOW_DEFAULTS[which];
  const set = (patch: Partial<OuterShadow>, transient = false) => setShadow(which, patch, transient);
  // Unlinking starts from the angle the shadow had, so it doesn't jump.
  const unlink = (follow: boolean) => set(follow ? { followLight: true } : { followLight: false, angle: (((lightFrom - 180) % 360) + 360) % 360 });
  return (
    <div className="control-group" data-shadow={which}>
      <h4 className="control-group__title">{title}</h4>
      <Toggle label={toggleLabel} helpId={helpId} checked={shadow.enabled} onChange={(enabled) => set({ enabled })} />
      {shadow.enabled && (
        <>
          {hint && <p className="control__hint">{hint}</p>}
          <Toggle label={`${title}: follow the light`} helpId="shadows.follow" checked={shadow.followLight} onChange={unlink} />
          {!shadow.followLight && (
            <>
              <DirectionDial
                label={`${title} direction`}
                helpId="shadows.angle"
                value={shadow.angle}
                describe={falls}
                onChange={(angle) => set({ angle }, true)}
                onCommit={commitDoc}
              />
              <Slider
                label={`${title} distance`}
                helpId="shadows.distance"
                unit="% of a square"
                min={0}
                max={25}
                step={0.1}
                value={toPct(shadow.distance)}
                defaultValue={toPct(base.distance)}
                onChange={(v) => set({ distance: fromPct(v) }, true)}
                onCommit={commitDoc}
              />
              <Slider
                label={`${title} blur`}
                helpId="shadows.blur"
                unit="% of a square"
                min={0}
                max={25}
                step={0.1}
                value={toPct(shadow.blur)}
                defaultValue={toPct(base.blur)}
                onChange={(v) => set({ blur: fromPct(v) }, true)}
                onCommit={commitDoc}
              />
              <ColorSwatches
                label={`${title} colour`}
                helpId="shadows.color"
                value={shadow.color}
                swatches={SHADOW_SWATCHES}
                onChange={(color) => set({ color }, true)}
                onCommit={commitDoc}
              />
              <Slider
                label={`${title} opacity`}
                helpId="shadows.opacity"
                unit="%"
                min={0}
                max={100}
                value={Math.round(shadow.opacity * 100)}
                defaultValue={Math.round(base.opacity * 100)}
                onChange={(v) => set({ opacity: v / 100 }, true)}
                onCommit={commitDoc}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function InnerShadowControls({ shadow }: { shadow: InnerShadow }) {
  const base = SHADOW_DEFAULTS.inner;
  const set = (patch: Partial<InnerShadow>, transient = false) => setShadow('inner', patch, transient);
  return (
    <div className="control-group" data-shadow="inner">
      <h4 className="control-group__title">Inner shadow</h4>
      <Toggle label="Inner shadow" helpId="shadows.inner" checked={shadow.enabled} onChange={(enabled) => set({ enabled })} />
      {shadow.enabled && (
        <>
          <Slider
            label="Inner shadow strength"
            helpId="shadows.innerStrength"
            unit="%"
            min={0}
            max={100}
            value={Math.round(shadow.strength * 100)}
            defaultValue={Math.round(base.strength * 100)}
            onChange={(v) => set({ strength: v / 100 }, true)}
            onCommit={commitDoc}
          />
          <Slider
            label="Inner shadow softness"
            helpId="shadows.innerSoftness"
            unit="% of a square"
            min={0}
            max={25}
            step={0.1}
            value={toPct(shadow.softness)}
            defaultValue={toPct(base.softness)}
            onChange={(v) => set({ softness: fromPct(v) }, true)}
            onCommit={commitDoc}
          />
        </>
      )}
    </div>
  );
}
