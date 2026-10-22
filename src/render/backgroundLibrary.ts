// The built-in background pictures (DESIGN.md §6.3). They are drawn by code
// (scripts/make-backgrounds.ts) and saved in public/backgrounds/, so there
// is nothing to credit or license (ASSETS-CREDITS.md).

export interface LibraryBackground {
  id: string;
  name: string;
}

export const BACKGROUND_LIBRARY: readonly LibraryBackground[] = [
  { id: 'forest', name: 'Forest' },
  { id: 'dungeon', name: 'Dungeon stone' },
  { id: 'parchment', name: 'Parchment' },
  { id: 'night-sky', name: 'Night sky' },
  { id: 'lava', name: 'Lava' },
  { id: 'water', name: 'Water' },
  { id: 'tavern', name: 'Tavern wood' },
  { id: 'snow', name: 'Snow' },
  { id: 'swamp', name: 'Swamp' },
  { id: 'desert', name: 'Desert' },
];

export const libraryImageUrl = (id: string) => `/backgrounds/${id}.webp`;
export const libraryThumbUrl = (id: string) => `/backgrounds/${id}-thumb.webp`;
