// Shapes and the 27 code-drawn frames (DESIGN.md §2, ported from the extension).

import type { FinishStyle } from './finishes';

export type ShapeId = 'circle' | 'rounded' | 'square' | 'hexagon' | 'flatHex';

/** 'none', Stamped, or one of the finishes in finishes.ts. */
export type FrameStyle = 'none' | 'stamped' | FinishStyle;

export const SHAPES: { id: ShapeId; name: string }[] = [
  { id: 'circle', name: 'Circle' },
  { id: 'rounded', name: 'Rounded' },
  { id: 'square', name: 'Square' },
  { id: 'hexagon', name: 'Hexagon' },
  { id: 'flatHex', name: 'Flat hex' },
];

export type FrameGroup = 'Classic' | 'Textures' | 'Classes';
export const FRAME_GROUPS: FrameGroup[] = ['Classic', 'Textures', 'Classes'];

export interface FramePreset {
  id: string;
  name: string;
  group: FrameGroup;
  style: FrameStyle;
  /** The colour the frame was designed around; any colour works. */
  color: string;
}

const p = (id: string, name: string, group: FrameGroup, style: FrameStyle, color: string): FramePreset => ({
  id,
  name,
  group,
  style,
  color,
});

export const FRAME_PRESETS: FramePreset[] = [
  p('stamped', 'Stamped', 'Classic', 'stamped', '#d7671f'),
  p('gilded', 'Gilded', 'Classic', 'gilded', '#d4a64a'),
  p('engraved', 'Engraved', 'Classic', 'engraved', '#7a7f8a'),
  p('arcane', 'Arcane', 'Classic', 'arcane', '#6fc3ff'),
  p('infernal', 'Infernal', 'Classic', 'arcane', '#ff6a3d'),
  p('double', 'Double line', 'Classic', 'double', '#c9b27a'),
  p('minimal', 'Polished', 'Classic', 'line', '#8a8f99'),
  p('none', 'No frame', 'Classic', 'none', '#ffffff'),

  p('oak', 'Oak', 'Textures', 'wood', '#8a5a32'),
  p('cobblestone', 'Cobblestone', 'Textures', 'stone', '#8b8579'),
  p('magma', 'Magma', 'Textures', 'magma', '#ff7a1a'),
  p('harlequin', 'Harlequin', 'Textures', 'harlequin', '#8c2f4a'),
  p('knotwork', 'Knotwork', 'Textures', 'braid', '#c9a24a'),
  p('starfield', 'Starfield', 'Textures', 'starfield', '#6a5ad8'),

  p('barbarian', 'Barbarian', 'Classes', 'claws', '#8a5a3a'),
  p('bard', 'Bard', 'Classes', 'notes', '#8e3b8f'),
  p('cleric', 'Cleric', 'Classes', 'radiant', '#e0b84a'),
  p('druid', 'Druid', 'Classes', 'vines', '#6aa83a'),
  p('fighter', 'Fighter', 'Classes', 'riveted', '#8c929c'),
  p('monk', 'Monk', 'Classes', 'beads', '#c4622c'),
  p('paladin', 'Paladin', 'Classes', 'holy', '#c9d2de'),
  p('ranger', 'Ranger', 'Classes', 'fletching', '#4f6b3a'),
  p('rogue', 'Rogue', 'Classes', 'stitched', '#4a3f3c'),
  p('sorcerer', 'Sorcerer', 'Classes', 'sorcerer', '#b8322a'),
  p('warlock', 'Warlock', 'Classes', 'eyes', '#5b2d7a'),
  p('wizard', 'Wizard', 'Classes', 'wizard', '#3f6fd8'),
  p('artificer', 'Artificer', 'Classes', 'clockwork', '#b5813a'),
];

export const framePresetById = (id: string) => FRAME_PRESETS.find((f) => f.id === id);

/** Every frame style there is, for checking saved documents. */
export const FRAME_STYLES = new Set<string>(FRAME_PRESETS.map((f) => f.style));
