// Export formats and resolutions (DESIGN.md §6.11).
//
// Still pictures only for now. Animated tokens (GIF, and maybe APNG or WebM)
// are a future feature (DESIGN.md §15): see `animated.ts` for where they plug in.

import { MAX_OUTPUT_SIDE, outputSize } from '../document/sizing';

export type ExportFormat = 'png' | 'webp' | 'jpg';

export interface FormatInfo {
  id: ExportFormat;
  /** Shown on buttons: "PNG". */
  label: string;
  mime: string;
  ext: string;
  /** False for JPG: see-through parts are filled with a colour. */
  transparent: boolean;
  /** WebP and JPG take a quality setting; PNG is always lossless. */
  lossy: boolean;
}

export const FORMATS: Record<ExportFormat, FormatInfo> = {
  png: { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', transparent: true, lossy: false },
  webp: { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', transparent: true, lossy: true },
  jpg: { id: 'jpg', label: 'JPG', mime: 'image/jpeg', ext: 'jpg', transparent: false, lossy: true },
};

export const FORMAT_IDS = Object.keys(FORMATS) as ExportFormat[];

/** The ready-made "pixels per square" choices; anything else is "custom". */
export const PX_PRESETS = [128, 256, 400, 512] as const;
export const MIN_CUSTOM_PX = 32;
export const MAX_CUSTOM_PX = MAX_OUTPUT_SIDE;

/** The final picture's side, and whether the 4096 px cap made it smaller than asked. */
export function finalSize(squares: number, pxPerSquare: number): { side: number; capped: boolean } {
  return { side: outputSize(squares, pxPerSquare), capped: Math.round(squares * pxPerSquare) > MAX_OUTPUT_SIDE };
}
