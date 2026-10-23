// The built-in presets (DESIGN.md §6.9). Each is a change to the starting
// token's look, so they always match the current document version. To swap
// them for looks made in the editor, copy each one's preset code from the
// Presets section and turn the codes into changes here.

import { createDocument, LIGHT_PRESETS, newDecoration, newEffect } from '../document/defaults';
import type { Decoration, DecorationKind, EffectKind, EffectLayer, LightPresetId, TokenDocument } from '../document/types';
import { framePresetById } from '../render/catalog';
import { createPreset, type TokenPreset } from './preset';

const frame = (doc: TokenDocument, presetId: string, patch: Partial<TokenDocument['frame']> = {}) => {
  const p = framePresetById(presetId)!;
  doc.frame = { ...doc.frame, kind: 'code', image: null, presetId: p.id, style: p.style, color: p.color, highlightColor: null, ...patch };
};
const light = (doc: TokenDocument, id: LightPresetId) => {
  const p = LIGHT_PRESETS.find((x) => x.id === id)!;
  doc.lighting = { ...doc.lighting, ...p.settings, rim: { ...p.settings.rim }, enabled: true, preset: id };
};
const effect = (kind: EffectKind, patch: Partial<EffectLayer> = {}): EffectLayer => ({ ...newEffect(kind, kind), ...patch });
const deco = (kind: DecorationKind, patch: Partial<Decoration> = {}): Decoration => ({ ...newDecoration(kind, kind), ...patch });

function preset(id: string, name: string, change: (doc: TokenDocument) => void): TokenPreset {
  const doc = createDocument(name);
  change(doc);
  return createPreset(doc, name, `builtin:${id}`);
}

export const BUILT_IN_PRESETS: readonly TokenPreset[] = [
  preset('boss', 'Boss', (d) => {
    frame(d, 'gilded', { thickness: 0.18 });
    light(d, 'firelight');
    d.effects = [effect('vignette'), effect('outerGlow', { color: '#ff3b1a', intensity: 85, size: 0.2 }), effect('embers', { intensity: 70 })];
    d.decorations = [deco('crown')];
    d.shadows.outer = { ...d.shadows.outer, distance: 0.05, blur: 0.14, opacity: 0.9 };
  }),
  preset('undead', 'Undead', (d) => {
    frame(d, 'engraved', { color: '#6c7078' });
    light(d, 'moonlight');
    d.effects = [effect('necrotic', { intensity: 80 }), effect('mist', { color: '#b7c4b0', intensity: 60 })];
    d.decorations = [deco('skull')];
  }),
  preset('party', 'Party member', (d) => {
    frame(d, 'minimal', { color: '#3f6fd8', thickness: 0.12 });
    d.decorations = [deco('ribbon', { color: '#2f5fa8' })];
  }),
  preset('minion', 'Minion', (d) => {
    frame(d, 'double', { color: '#8a8f99', thickness: 0.08, outerSpacing: 0.06 });
    d.shadows.outer = { ...d.shadows.outer, distance: 0.02, blur: 0.06, opacity: 0.6 };
  }),
  preset('fey', 'Fey', (d) => {
    frame(d, 'druid');
    light(d, 'holy');
    d.lighting = { ...d.lighting, color: '#d8ffd0', preset: null };
    d.effects = [effect('innerGlow', { color: '#76ff4a', intensity: 55 }), effect('sparkles', { color: '#ff9ad2' })];
    d.decorations = [deco('leaf', { place: 'topLeft', mirror: true })];
  }),
  preset('fiend', 'Fiend', (d) => {
    frame(d, 'infernal');
    light(d, 'firelight');
    d.effects = [effect('fire', { intensity: 90 })];
    d.decorations = [deco('horn', { color: '#3a2a22' })];
  }),
  preset('celestial', 'Celestial', (d) => {
    frame(d, 'paladin');
    light(d, 'holy');
    d.effects = [effect('radiant', { intensity: 80 })];
    d.decorations = [deco('wing'), deco('holySymbol')];
  }),
  preset('construct', 'Construct', (d) => {
    frame(d, 'fighter');
    d.effects = [effect('lightning', { intensity: 70, size: 0.14 })];
    d.decorations = [deco('chain'), deco('gem', { color: '#2f7fd8' })];
  }),
];
