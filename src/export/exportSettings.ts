// The Export panel's choices (DESIGN.md §6.11). They are about the file, not
// the look, so they live outside the TokenDocument (presets and undo leave
// them alone) and are remembered in localStorage.

import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { DEFAULT_PX_PER_SQUARE } from '../document/sizing';
import { FORMAT_IDS, MAX_CUSTOM_PX, MIN_CUSTOM_PX, type ExportFormat } from './formats';

export interface ExportSettings {
  format: ExportFormat;
  pxPerSquare: number;
  /** 1…100, for WebP. */
  quality: number;
  /**
   * A file name typed by the user, and the token name it was typed for. A new
   * name (another picture, or a rename) goes back to following the token name.
   */
  fileName: { text: string; forName: string } | null;
}

const KEY = 'tm.export';
export const DEFAULT_EXPORT: ExportSettings = { format: 'png', pxPerSquare: DEFAULT_PX_PER_SQUARE, quality: 92, fileName: null };

function load(): ExportSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ExportSettings> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_EXPORT;
    return {
      format: FORMAT_IDS.includes(raw.format as ExportFormat) ? (raw.format as ExportFormat) : DEFAULT_EXPORT.format,
      pxPerSquare: clampPx(Number(raw.pxPerSquare) || DEFAULT_EXPORT.pxPerSquare),
      quality: Math.min(100, Math.max(1, Math.round(Number(raw.quality) || DEFAULT_EXPORT.quality))),
      fileName: null,
    };
  } catch {
    return DEFAULT_EXPORT;
  }
}

export const clampPx = (px: number) => Math.min(MAX_CUSTOM_PX, Math.max(MIN_CUSTOM_PX, Math.round(px)));

export const exportSettings = createStore<ExportSettings>(load);
export const useExportSettings = <T>(select: (s: ExportSettings) => T) => useStore(exportSettings, select);
export const getExportSettings = () => exportSettings.getState();

export function setExportSettings(patch: Partial<ExportSettings>): void {
  exportSettings.setState(patch);
  const { format, pxPerSquare, quality } = exportSettings.getState();
  try {
    localStorage.setItem(KEY, JSON.stringify({ format, pxPerSquare, quality }));
  } catch {
    /* private browsing: just don't remember */
  }
}

/** Only letters, digits, spaces, `-` and `_` (DESIGN.md §6.11); accents are dropped. */
export function safeBaseName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 _-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'token'
  );
}

/** A file name with only safe characters, e.g. "Goblin Boss" → "Goblin-Boss.png". */
export function safeFileName(name: string, ext: string): string {
  return `${safeBaseName(name)}.${ext}`;
}

/** The file name (without extension) for this token: what the user typed, or the token's name. */
export function baseNameFor(tokenName: string, s: Pick<ExportSettings, 'fileName'> = getExportSettings()): string {
  return s.fileName && s.fileName.forName === tokenName ? safeBaseName(s.fileName.text) : safeBaseName(tokenName);
}

/**
 * Names for a batch ZIP: each token's own safe name, with "-2", "-3"… added
 * when two would clash (names are compared ignoring case, as Windows does).
 */
export function uniqueFileNames(bases: string[], ext: string): string[] {
  const used = new Set<string>();
  return bases.map((b) => {
    const base = safeBaseName(b);
    let name = `${base}.${ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}.${ext}`;
    used.add(name.toLowerCase());
    return name;
  });
}
