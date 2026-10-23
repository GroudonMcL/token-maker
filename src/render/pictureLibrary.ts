// Pictures used as effects and decorations (v8). The built-in ones are CC0
// sprites and icons from Kenney (kenney.nl; see ASSETS-CREDITS.md), saved in
// public/pictures/; the user's own are kept in IndexedDB
// (src/state/pictureLibrary.ts). Either way the picture is held in the asset
// store under pictureAssetId(), so the renderer only ever reads the assets.

import type { BlendMode, EffectPlacement, PictureSource } from '../document/types';

/** How scattered copies of a picture effect turn. */
export type PictureOrient = 'random' | 'outward' | 'upright';

export interface LibraryEffectPicture {
  id: string;
  name: string;
  orient: PictureOrient;
  /** Starting settings. */
  defaults: { placement: EffectPlacement; color: string; blend: BlendMode; size: number; spread: number; intensity: number };
  swatches: string[];
}

export interface LibraryDecorationPicture {
  id: string;
  name: string;
  color: string;
  swatches: string[];
}

const fx = (
  id: string,
  name: string,
  orient: PictureOrient,
  defaults: LibraryEffectPicture['defaults'],
  swatches: string[] = [],
): LibraryEffectPicture => ({ id: `fx-${id}`, name, orient, defaults, swatches: [defaults.color, ...swatches.filter((c) => c !== defaults.color)] });

/** Picture effects: white sprites, coloured by the effect's colour and scattered round the token. */
export const EFFECT_PICTURES: readonly LibraryEffectPicture[] = [
  fx('smoke-puffs', 'Smoke puffs', 'random', { placement: 'over', color: '#c9ccd6', blend: 'screen', size: 0.3, spread: 40, intensity: 70 }, ['#5b5f6b', '#76ff4a', '#8b5cd6']),
  fx('flame-licks', 'Flame licks', 'outward', { placement: 'border', color: '#ff8a2a', blend: 'screen', size: 0.22, spread: 60, intensity: 95 }, ['#ff3b1a', '#4aa8ff', '#76ff4a', '#c05aff']),
  fx('wisps', 'Wisps', 'random', { placement: 'over', color: '#9fd8ff', blend: 'screen', size: 0.3, spread: 35, intensity: 80 }, ['#76ff4a', '#b06aff', '#ffffff']),
  fx('crackles', 'Crackles', 'random', { placement: 'border', color: '#8fd0ff', blend: 'screen', size: 0.3, spread: 40, intensity: 95 }, ['#ffffff', '#ffe36a', '#c08aff']),
  fx('twinkles', 'Twinkles', 'random', { placement: 'over', color: '#fff4c4', blend: 'screen', size: 0.18, spread: 40, intensity: 95 }, ['#ffffff', '#9fd8ff', '#ff9ad2']),
  fx('orbs', 'Orbs', 'random', { placement: 'over', color: '#ffd76a', blend: 'screen', size: 0.12, spread: 50, intensity: 85 }, ['#9fd8ff', '#76ff4a', '#ff6fb5']),
  fx('swirls', 'Swirls', 'random', { placement: 'over', color: '#b06aff', blend: 'screen', size: 0.4, spread: 30, intensity: 80 }, ['#6fc3ff', '#76ff4a', '#ffffff']),
  fx('arcane-circle', 'Arcane circle', 'upright', { placement: 'over', color: '#b06aff', blend: 'screen', size: 0.9, spread: 0, intensity: 85 }, ['#6fc3ff', '#ffd76a', '#ff3b3b']),
  fx('hearts', 'Hearts', 'random', { placement: 'over', color: '#ff6fb5', blend: 'normal', size: 0.14, spread: 30, intensity: 90 }, ['#ff3b6a', '#ff9ad2', '#c08aff']),
  fx('claw-marks', 'Claw marks', 'random', { placement: 'over', color: '#8a0b0b', blend: 'normal', size: 0.5, spread: 10, intensity: 85 }, ['#5a0606', '#1c1c1c', '#ffffff']),
  fx('splatter', 'Splatter', 'random', { placement: 'over', color: '#8a0b0b', blend: 'normal', size: 0.35, spread: 25, intensity: 85 }, ['#3a6a1a', '#1c1c1c', '#5b2a86']),
  fx('scorch', 'Scorch marks', 'random', { placement: 'over', color: '#1c1410', blend: 'multiply', size: 0.35, spread: 25, intensity: 80 }, ['#000000', '#3a1a0a']),
];

const METAL = ['#e0b23a', '#c9d2de', '#b5813a', '#1c1c1c', '#ffffff'];
const deco = (id: string, name: string, color: string, swatches: string[] = METAL): LibraryDecorationPicture => ({
  id: `deco-${id}`,
  name,
  color,
  swatches: [color, ...swatches.filter((c) => c !== color)],
});

/** Picture decorations: flat icons with a dark outline, coloured by the decoration's colour. */
export const DECORATION_PICTURES: readonly LibraryDecorationPicture[] = [
  deco('skull-icon', 'Skull icon', '#e9e1cc', ['#e9e1cc', '#3a3a3a', '#76ff4a', '#c0263a']),
  deco('heart', 'Heart', '#c0263a', ['#c0263a', '#ff6fb5', '#ffffff']),
  deco('broken-heart', 'Broken heart', '#c0263a', ['#c0263a', '#5a0606', '#8a8a8a']),
  deco('shield-icon', 'Shield icon', '#3f6fd8', ['#3f6fd8', '#b8322a', '#2f7a3a', '#e0b23a']),
  deco('sword-icon', 'Sword icon', '#c9d2de'),
  deco('crown-icon', 'Crown icon', '#e0b23a'),
  deco('flame', 'Flame', '#ff7a1a', ['#ff7a1a', '#ffd24a', '#4aa8ff', '#76ff4a']),
  deco('potion', 'Potion', '#c0263a', ['#c0263a', '#2f7fd8', '#2fae5a', '#8a3fd0']),
  deco('hourglass', 'Hourglass', '#e0b23a'),
  deco('padlock', 'Padlock', '#c9d2de'),
  deco('spellbook', 'Spellbook', '#8a3fd0', ['#8a3fd0', '#b8322a', '#2f5fa8', '#b5813a']),
  deco('pouch', 'Pouch', '#b5813a', ['#b5813a', '#e0b23a', '#8a5a32']),
  deco('flag', 'Flag', '#b8322a', ['#b8322a', '#2f5fa8', '#2f7a3a', '#ffffff']),
  deco('award', 'Award', '#e0b23a'),
];

export const pictureUrl = (id: string) => `/pictures/${id}.webp`;

/** The asset-store key of a picture. */
export const pictureAssetId = (source: PictureSource) => `picture:${source.type}:${source.id}`;

export const effectPicture = (id: string) => EFFECT_PICTURES.find((p) => p.id === id);
export const decorationPicture = (id: string) => DECORATION_PICTURES.find((p) => p.id === id);
export const isLibraryPicture = (id: string) => !!effectPicture(id) || !!decorationPicture(id);
