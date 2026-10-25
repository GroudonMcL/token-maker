// Starting values for effects (DESIGN.md §5.4), kept apart from defaults.ts
// so the style library can use them without a circular import.

import type { Effect, EffectKind } from './types';

/** A new effect of each kind, set up to look good straight away (DESIGN.md §5.4). */
export const NEW_EFFECT: Record<EffectKind, () => Effect> = {
  bevel: () => ({
    kind: 'bevel',
    on: true,
    direction: 'raised',
    profile: 'rounded',
    size: 0.18,
    depth: 1,
    soften: 0.02,
    highlight: '#ffffff',
    highlightOpacity: 0.75,
    shadow: '#000000',
    shadowOpacity: 0.6,
    gloss: 0.3,
    lightHeight: 35,
    surface: 'smooth',
    surfaceDepth: 0.5,
    surfaceScale: 0.25,
    seed: 1,
  }),
  shadow: () => ({ kind: 'shadow', on: true, inner: false, color: '#000000', opacity: 0.6, distance: 0.06, blur: 0.08 }),
  glow: () => ({ kind: 'glow', on: true, inner: false, color: '#ffb84a', opacity: 0.8, size: 0.2 }),
  recolour: () => ({
    kind: 'recolour',
    on: true,
    stops: [
      { at: 0, color: '#2a1404', opacity: 1 },
      { at: 0.45, color: '#a8701e', opacity: 1 },
      { at: 0.75, color: '#f0c860', opacity: 1 },
      { at: 1, color: '#fff8dc', opacity: 1 },
    ],
    amount: 1,
  }),
  adjust: () => ({ kind: 'adjust', on: true, hue: 0, saturation: 0, brightness: 0, contrast: 0 }),
  wear: () => ({ kind: 'wear', on: true, chips: 0.35, polish: 0.4, grime: 0.4, grimeColor: '#2a2016', scale: 0.3, seed: 1, scratches: 0 }),
  distort: () => ({ kind: 'distort', on: true, amount: 0.04, scale: 0.3, seed: 1 }),
  extrude: () => ({ kind: 'extrude', on: true, depth: 0.08, shade: 0.55 }),
  offset: () => ({ kind: 'offset', on: true, amount: 0.04 }),
};

/** What each effect is called in the interface. */
export const EFFECT_NAMES: Record<EffectKind, string> = {
  bevel: 'Bevel and surface',
  shadow: 'Shadow',
  glow: 'Glow',
  recolour: 'Material colour',
  adjust: 'Colour adjust',
  wear: 'Wear and grime',
  distort: 'Distortion',
  extrude: 'Sides (extrude)',
  offset: 'Grow or shrink',
};
