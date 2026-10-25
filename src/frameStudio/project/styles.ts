// The style library (DESIGN.md §6.4): ready-made stacks of effects that turn
// any layer into a material or a magical finish in one click. A style is only
// effects, so it works on any layer, group or Token Maker frame; afterwards
// each effect is an ordinary one that can be changed or removed.
//
// Metals are a bevel (lit greys) followed by a material colour (a gradient
// map from dark to light), which is how the shine becomes gold or bronze
// whatever colour the layer was.

import { NEW_EFFECT } from './effectDefaults';
import type { Effect, GradientStop } from './types';

/** Colour ramps from dark to light for the material colour effect. */
export interface Material {
  id: string;
  name: string;
  stops: GradientStop[];
}

const ramp = (...colors: string[]): GradientStop[] => colors.map((color, i) => ({ at: i / (colors.length - 1), color, opacity: 1 }));

export const MATERIALS: Material[] = [
  { id: 'gold', name: 'Gold', stops: ramp('#2a1404', '#7a4a10', '#c8962a', '#f0d070', '#fffae0') },
  { id: 'silver', name: 'Silver', stops: ramp('#16181c', '#4a5058', '#9aa2ac', '#dfe4ea', '#ffffff') },
  { id: 'bronze', name: 'Bronze', stops: ramp('#1c0e04', '#5a3414', '#9a6430', '#d0a060', '#f6e0b0') },
  { id: 'copper', name: 'Copper', stops: ramp('#1e0804', '#6a2810', '#b8602e', '#eea070', '#ffe4cc') },
  { id: 'iron', name: 'Blackened iron', stops: ramp('#060606', '#1c1d20', '#3c3e44', '#7a7e88', '#c8ccd4') },
  { id: 'steel', name: 'Steel', stops: ramp('#101418', '#3a424c', '#7a8694', '#c4ccd6', '#f4f8fc') },
  { id: 'stone', name: 'Grey stone', stops: ramp('#1a1918', '#45423e', '#77736c', '#a9a49b', '#d8d4cc') },
  { id: 'bone', name: 'Bone', stops: ramp('#2a2014', '#6a5a40', '#b0a07c', '#e0d4b4', '#fffaf0') },
  { id: 'obsidian', name: 'Obsidian', stops: ramp('#020104', '#0e0a16', '#241c34', '#5a5070', '#d0c8e8') },
  { id: 'jade', name: 'Jade', stops: ramp('#021208', '#0c3a20', '#2a7a4a', '#78c898', '#e0fff0') },
  { id: 'amethyst', name: 'Amethyst', stops: ramp('#0c0418', '#34145a', '#7a3ab8', '#c08af0', '#f6e8ff') },
  { id: 'ruby', name: 'Ruby', stops: ramp('#140204', '#500814', '#a81830', '#f05a6a', '#ffe0e4') },
  { id: 'ice', name: 'Ice', stops: ramp('#0a1a2a', '#2a5a7a', '#6aaad0', '#c0e8fa', '#ffffff') },
  { id: 'wood', name: 'Dark wood', stops: ramp('#120804', '#3a200e', '#6e4424', '#a87850', '#e0c098') },
];

export const materialStops = (id: string) => (MATERIALS.find((m) => m.id === id) ?? MATERIALS[0]).stops.map((s) => ({ ...s }));

export interface EffectStyle {
  id: string;
  name: string;
  group: 'Metal' | 'Stone and bone' | 'Crystal' | 'Carving' | 'Magic' | 'Finish';
  description: string;
  effects: () => Effect[];
}

// Effect makers, also used by the templates that show effects off (defaults.ts).
export const bevel = (patch: Partial<Extract<Effect, { kind: 'bevel' }>> = {}): Effect => ({ ...(NEW_EFFECT.bevel() as Extract<Effect, { kind: 'bevel' }>), ...patch });
export const shadow = (patch: Partial<Extract<Effect, { kind: 'shadow' }>> = {}): Effect => ({ ...(NEW_EFFECT.shadow() as Extract<Effect, { kind: 'shadow' }>), ...patch });
export const glow = (patch: Partial<Extract<Effect, { kind: 'glow' }>> = {}): Effect => ({ ...(NEW_EFFECT.glow() as Extract<Effect, { kind: 'glow' }>), ...patch });
export const material = (id: string, amount = 1): Effect => ({ kind: 'recolour', on: true, stops: materialStops(id), amount });
export const adjust = (patch: Partial<Extract<Effect, { kind: 'adjust' }>> = {}): Effect => ({ ...(NEW_EFFECT.adjust() as Extract<Effect, { kind: 'adjust' }>), ...patch });
export const wear = (patch: Partial<Extract<Effect, { kind: 'wear' }>> = {}): Effect => ({ ...(NEW_EFFECT.wear() as Extract<Effect, { kind: 'wear' }>), ...patch });

export const STYLES: EffectStyle[] = [
  // Metal
  { id: 'gold', name: 'Polished gold', group: 'Metal', description: 'Rounded, shiny gold, whatever colour the layer was.', effects: () => [bevel({ size: 0.22, gloss: 0.7 }), material('gold')] },
  { id: 'silver', name: 'Silver', group: 'Metal', description: 'Bright, cool silver with a sharp shine.', effects: () => [bevel({ size: 0.2, gloss: 0.85 }), material('silver')] },
  {
    id: 'hammered-bronze',
    name: 'Hammered bronze',
    group: 'Metal',
    description: 'Bronze beaten into overlapping dents, each catching the light.',
    effects: () => [bevel({ size: 0.2, gloss: 0.45, surface: 'hammered', surfaceDepth: 0.7, surfaceScale: 0.22 }), material('bronze')],
  },
  {
    id: 'blackened-iron',
    name: 'Blackened iron',
    group: 'Metal',
    description: 'Dark forged iron: chipped, rubbed bright at the edges, a little grimy.',
    effects: () => [wear({ chips: 0.25, polish: 0.55, grime: 0.3 }), bevel({ profile: 'chisel', size: 0.12, gloss: 0.25, surface: 'grain', surfaceDepth: 0.35 }), material('iron')],
  },
  { id: 'brushed-steel', name: 'Brushed steel', group: 'Metal', description: 'Steel with fine streaks running round the token.', effects: () => [bevel({ size: 0.16, gloss: 0.55, surface: 'brushed', surfaceDepth: 0.3 }), material('steel')] },
  {
    id: 'verdigris',
    name: 'Verdigris copper',
    group: 'Metal',
    description: 'Old copper with green patina gathered in patches.',
    effects: () => [bevel({ size: 0.2, gloss: 0.4, surface: 'grain', surfaceDepth: 0.25 }), material('copper'), wear({ chips: 0, polish: 0.25, grime: 0.55, grimeColor: '#3f8f7a' })],
  },
  // Stone and bone
  {
    id: 'carved-stone',
    name: 'Carved stone',
    group: 'Stone and bone',
    description: 'Chiselled grey stone with a rough surface and worn edges.',
    effects: () => [wear({ chips: 0.4, polish: 0, grime: 0.3, grimeColor: '#1a1814' }), bevel({ profile: 'chisel', size: 0.1, gloss: 0, surface: 'grain', surfaceDepth: 0.6 }), material('stone')],
  },
  { id: 'flagstone', name: 'Cracked flagstone', group: 'Stone and bone', description: 'Stone split into a network of plates.', effects: () => [bevel({ profile: 'chisel', size: 0.1, gloss: 0, surface: 'cracked', surfaceDepth: 1, surfaceScale: 0.35 }), material('stone')] },
  { id: 'obsidian', name: 'Obsidian', group: 'Stone and bone', description: 'Glassy black volcanic stone with a mirror shine.', effects: () => [bevel({ size: 0.25, gloss: 1, highlightOpacity: 0.5 }), material('obsidian')] },
  {
    id: 'bone',
    name: 'Ancient bone',
    group: 'Stone and bone',
    description: 'Smooth, yellowed bone with grime in its pores.',
    effects: () => [bevel({ size: 0.3, gloss: 0.15, surface: 'grain', surfaceDepth: 0.25, soften: 0.04 }), material('bone'), wear({ chips: 0.15, polish: 0, grime: 0.5, grimeColor: '#4a3a24' })],
  },
  { id: 'scales', name: 'Dragon scales', group: 'Stone and bone', description: 'Rows of domed scales; keeps the layer’s colour.', effects: () => [bevel({ size: 0.15, gloss: 0.5, surface: 'scales', surfaceDepth: 0.9, surfaceScale: 0.3 })] },
  // Crystal
  { id: 'gem', name: 'Glossy gem', group: 'Crystal', description: 'A domed, polished stone with a bright shine; keeps the layer’s colour.', effects: () => [bevel({ size: 0.5, depth: 0.8, gloss: 1, highlightOpacity: 0.55 }), glow({ inner: true, color: '#ffffff', opacity: 0.25, size: 0.1 })] },
  {
    id: 'amethyst',
    name: 'Amethyst crystal',
    group: 'Crystal',
    description: 'Sharp-edged purple crystal glowing from inside.',
    effects: () => [bevel({ profile: 'chisel', size: 0.3, gloss: 0.9 }), material('amethyst'), glow({ inner: true, color: '#e0b0ff', opacity: 0.45, size: 0.15 }), glow({ color: '#9a5aff', opacity: 0.6, size: 0.25 })],
  },
  {
    id: 'ice',
    name: 'Ice',
    group: 'Crystal',
    description: 'Cold, glassy ice with a pale shimmer.',
    effects: () => [bevel({ profile: 'chisel', size: 0.25, gloss: 0.9 }), material('ice'), glow({ color: '#c0f0ff', opacity: 0.4, size: 0.15 })],
  },
  // Carving
  { id: 'engraved', name: 'Engraved', group: 'Carving', description: 'Cut into the surface below it: put it on runes or lines over a band.', effects: () => [bevel({ direction: 'sunken', profile: 'chisel', size: 0.05, depth: 1.5, gloss: 0.1 }), shadow({ inner: true, distance: 0.02, blur: 0.02, opacity: 0.7 })] },
  { id: 'embossed', name: 'Embossed', group: 'Carving', description: 'Pressed up out of the surface, with a small shadow.', effects: () => [bevel({ profile: 'chisel', size: 0.05, depth: 1.5, gloss: 0.1 }), shadow({ distance: 0.025, blur: 0.03, opacity: 0.55 })] },
  { id: 'stepped', name: 'Stepped rim', group: 'Carving', description: 'Terraced steps up from the edge, like a turned metal rim.', effects: () => [bevel({ profile: 'stepped', size: 0.4, gloss: 0.4 })] },
  { id: 'coin-rim', name: 'Coin rim', group: 'Carving', description: 'A raised lip round the edge with a lower middle.', effects: () => [bevel({ profile: 'ridge', size: 0.25, gloss: 0.4 })] },
  // Magic
  { id: 'arcane', name: 'Arcane glow', group: 'Magic', description: 'A violet aura with a bright core.', effects: () => [glow({ inner: true, color: '#ffffff', opacity: 0.5, size: 0.06 }), glow({ color: '#9a5aff', opacity: 0.9, size: 0.3 })] },
  { id: 'hellfire', name: 'Hellfire', group: 'Magic', description: 'Burning orange light, hottest at the middle.', effects: () => [glow({ inner: true, color: '#ffe08a', opacity: 0.6, size: 0.08 }), glow({ color: '#ff4a0a', opacity: 0.95, size: 0.35 })] },
  { id: 'holy', name: 'Holy radiance', group: 'Magic', description: 'Soft golden light spreading wide.', effects: () => [glow({ inner: true, color: '#ffffff', opacity: 0.4, size: 0.08 }), glow({ color: '#ffe8a0', opacity: 0.85, size: 0.45 })] },
  { id: 'necrotic', name: 'Necrotic', group: 'Magic', description: 'Sickly green light and decay.', effects: () => [wear({ chips: 0.2, polish: 0, grime: 0.5, grimeColor: '#1a2a10' }), adjust({ saturation: -0.4 }), glow({ color: '#6aff5a', opacity: 0.7, size: 0.3 })] },
  { id: 'frost', name: 'Frost', group: 'Magic', description: 'An icy blue haze.', effects: () => [glow({ inner: true, color: '#e8fbff', opacity: 0.5, size: 0.1 }), glow({ color: '#7fd8ff', opacity: 0.8, size: 0.3 })] },
  // Finish
  { id: 'shadow', name: 'Soft shadow', group: 'Finish', description: 'A soft shadow falling away from the light.', effects: () => [shadow({ distance: 0.06, blur: 0.1, opacity: 0.6 })] },
  { id: 'raised', name: 'Raised', group: 'Finish', description: 'A simple rounded bevel that keeps the layer’s colour.', effects: () => [bevel()] },
  { id: 'aged', name: 'Aged and worn', group: 'Finish', description: 'Chipped edges, grime and faded colour.', effects: () => [wear({ chips: 0.4, polish: 0.3, grime: 0.5 }), adjust({ saturation: -0.35, contrast: -0.1 })] },
];

export const STYLE_GROUPS = ['Metal', 'Stone and bone', 'Crystal', 'Carving', 'Magic', 'Finish'] as const;

/** A copy of a style's effects, by id (for templates). */
export const styleEffects = (id: string): Effect[] => (STYLES.find((s) => s.id === id) ?? STYLES[0]).effects();
