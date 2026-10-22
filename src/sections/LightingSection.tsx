import { Flame, FlameKindling, Moon, Sparkles, Sun, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { ColorSwatches, ControlLabel, DirectionDial, Slider, Toggle } from '../components';
import { DEFAULT_LIGHTING, LIGHT_PRESETS } from '../document/defaults';
import type { LightingSettings, LightPresetId } from '../document/types';
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
 * Lighting & shadows section (DESIGN.md §6.5). Phase 4 builds the light;
 * the shadow controls join in Phase 5. The direction is always shown,
 * because shadows already fall away from it.
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
      <p className="control__hint">Shadow settings come in a later update. Shadows already fall away from the light.</p>
    </>
  );
}
